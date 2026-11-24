/* Room persistence and move authorization, independent of Cloudflare's transport. */
import {initialBoard,validateMove,performRound} from './engine.mjs';
const MAX_IDLE_MS=7*24*60*60*1000;
export class RoomError extends Error {
  constructor(status,message){super(message);this.status=status;this.name='RoomError';}
}
export function createToken(bytes=24){const arr=new Uint8Array(bytes);crypto.getRandomValues(arr);return btoa(String.fromCharCode(...arr)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export async function tokenHash(token){const encoded=new TextEncoder().encode(token);const buff=await crypto.subtle.digest('SHA-256',encoded);return Array.from(new Uint8Array(buff),c=>c.toString(16).padStart(2,'0')).join('');}
function equalHash(a,b){if(!a||!b||a.length!==b.length)return false;let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);return mismatch===0;}
export function roomSnapshot(room,role,now=Date.now()){
  const side=role==='host'?'W':'B',other=side==='W'?'B':'W';
  return {
    roomId:room.id,role,revision:room.revision,round:room.round,
    board:room.board,history:room.history,last:room.last,lastResult:room.lastResult,
    outcome:room.outcome,consecutivePass:room.consecutivePass,
    guestJoined:!!room.guestHash,myLocked:!!room.moves[side],opponentLocked:!!room.moves[other],
    opponentConnected:!!room.guestHash && !!room.seen[other] && now-room.seen[other]<25000,
    expiresAt:room.expiresAt
  };
}
export class RoomService {
  constructor(storage,clock=()=>Date.now()){this.storage=storage;this.clock=clock;}
  active(room){if(!room)throw new RoomError(404,'Game room not found. Ask for a new invitation.');if(this.clock()>room.expiresAt)throw new RoomError(410,'This game has expired. Create a new game.');return room;}
  async authorize(room,token){
    if(typeof token!=='string'||token.length<20||token.length>256)throw new RoomError(401,'Your game access token is missing.');
    const hash=await tokenHash(token);
    if(equalHash(hash,room.hostHash))return 'host';
    if(equalHash(hash,room.guestHash))return 'guest';
    throw new RoomError(403,'This invitation or session is not valid.');
  }
  async create(id,hostToken,inviteToken){
    const hostHash=await tokenHash(hostToken),inviteHash=await tokenHash(inviteToken),now=this.clock();
    return await this.storage.transaction(async tx=>{
      if(await tx.get('room'))throw new RoomError(409,'This room already exists.');
      const board=initialBoard();
      const room={id,hostHash,inviteHash,guestHash:null,createdAt:now,expiresAt:now+MAX_IDLE_MS,
        board,history:[{round:0,board:initialBoard(),whiteLabel:'—',blackLabel:'—',events:['Starting position']}],
        round:1,last:null,lastResult:null,outcome:null,consecutivePass:0,moves:{W:null,B:null},seen:{W:now,B:0},revision:1};
      await tx.put('room',room);
      return roomSnapshot(room,'host',now);
    });
  }
  async join(inviteToken,newGuestToken){
    if(typeof inviteToken!=='string'||inviteToken.length<20||inviteToken.length>256)throw new RoomError(403,'Invalid invitation. Ask for a new game link.');
    const hash=await tokenHash(inviteToken),guestHash=await tokenHash(newGuestToken),now=this.clock();
    return this.storage.transaction(async tx=>{
      const room=this.active(await tx.get('room'));
      if(!equalHash(hash,room.inviteHash))throw new RoomError(403,'Invalid invitation. Ask for a new game link.');
      if(room.guestHash)throw new RoomError(409,'Someone has already joined this game. Ask the host for a new invitation.');
      room.guestHash=guestHash;
      room.seen.B=now;
      room.revision++;
      await tx.put('room',room);
      return roomSnapshot(room,'guest',now);
    });
  }
  async get(token){
    const room=this.active(await this.storage.get('room'));
    const role=await this.authorize(room,token),now=this.clock(),side=role==='host'?'W':'B';
    // Presence updates are throttled so ordinary polling does not write on every request.
    if(now-room.seen[side]>=12000){
      return this.storage.transaction(async tx=>{
        const current=this.active(await tx.get('room'));
        await this.authorize(current,token);
        if(now-current.seen[side]>=12000){current.seen[side]=now;await tx.put('room',current);}
        return roomSnapshot(current,role,now);
      });
    }
    return roomSnapshot(room,role,now);
  }
  async submit(token,requestedRound,rawMove){
    const room=this.active(await this.storage.get('room'));
    const role=await this.authorize(room,token),side=role==='host'?'W':'B',now=this.clock();
    return this.storage.transaction(async tx=>{
      const current=this.active(await tx.get('room'));
      // Re-check identity after the transactional read.
      await this.authorize(current,token);
      if(!current.guestHash)throw new RoomError(409,'Waiting for a second player to join.');
      if(current.outcome)throw new RoomError(409,'The game is already finished.');
      if(!Number.isInteger(requestedRound)||requestedRound!==current.round)throw new RoomError(409,'The game advanced to a new round. Refresh your board.');
      if(current.moves[side])throw new RoomError(409,'Your move is already locked for this round.');
      let move;
      try {move=validateMove(current.board,side,rawMove);}
      catch(e){throw new RoomError(422,e.message || 'Invalid move.');}
      current.moves[side]=move;
      current.seen[side]=now;
      if(current.moves.W && current.moves.B)performRound(current);
      current.revision++;
      await tx.put('room',current);
      return roomSnapshot(current,role,now);
    });
  }
}

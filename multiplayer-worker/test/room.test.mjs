import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomService,RoomError,createToken} from '../src/room.mjs';
import {initialBoard,movesFor,resolveRound,validateMove,makePiece} from '../src/engine.mjs';
class MockStorage {
 constructor(){this.map=new Map();this.queue=Promise.resolve();}
 async get(key){return structuredClone(this.map.get(key));}
 async put(key,value){this.map.set(key,structuredClone(value));}
 async transaction(fn){
  // Serialize concurrent writes like a Durable Object storage transaction.
  const last=this.queue;let release;this.queue=new Promise(resolve=>release=resolve);
  await last;try{return await fn({get:k=>this.get(k),put:(k,v)=>this.put(k,v)});}finally{release();}
 }
}
async function setup(){const db=new MockStorage(),clock={now:1000},service=new RoomService(db,()=>clock.now);
 const host=createToken(),invite=createToken(),guest=createToken();await service.create('ABCDEFGHIJKLMNOPQRSTUV',host,invite);
 return {db,clock,service,host,invite,guest};
}
const move=(fromR,fromC,toR,toC)=>({from:{r:fromR,c:fromC},to:{r:toR,c:toC}});
const isRoomError=(status)=>e=>e instanceof RoomError&&e.status===status;
test('initial state contains all 32 pieces and king is the third rook',()=>{
 const b=initialBoard();assert.equal(b.flat().filter(Boolean).length,32);assert.equal(b[0][4].life,'crown');assert.equal(b[7][4].life,'crown');
 assert.deepEqual(movesFor(b,7,4),[]);
});
test('roles are locked to bearer tokens; public state never reveals secret moves',async()=>{
 const {service,host,invite,guest}=await setup();
 const before=await service.get(host);assert.equal(before.guestJoined,false);assert.equal(before.role,'host');
 await assert.rejects(service.get('not a token'),isRoomError(401));
 const joined=await service.join(invite,guest);assert.equal(joined.role,'guest');
 await assert.rejects(service.join(invite,createToken()),isRoomError(409));
 await assert.rejects(service.get(invite),isRoomError(403));
 const white=await service.submit(host,1,move(6,4,4,4));assert.equal(white.myLocked,true);assert.equal(white.opponentLocked,false);
 const black=await service.get(guest);assert.equal(black.myLocked,false);assert.equal(black.opponentLocked,true);
 assert.equal(JSON.stringify(black).includes('"moves"'),false);
 assert.equal(JSON.stringify(black).includes('"from"'),false);
 assert.equal(black.board[6][4].type,'p'); // No move revealed before both lock.
 await assert.rejects(service.submit(host,1,move(6,3,4,3)),isRoomError(409));
});
test('independent move submissions resolve once and persist through service restart',async()=>{
 const {db,service,host,invite,guest}=await setup();await service.join(invite,guest);
 const before=await service.submit(guest,1,move(1,4,3,4));assert.equal(before.round,1);
 const after=await service.submit(host,1,move(6,4,4,4));assert.equal(after.round,2);
 assert.equal(after.board[4][4].side,'W');assert.equal(after.board[3][4].side,'B');
 assert.equal(after.history.length,2);assert.equal(after.history[1].whiteLabel,'Pawn e2 → e4');
 await assert.rejects(service.submit(host,1,move(6,3,4,3)),isRoomError(409));
 const restored=new RoomService(db,()=>1000);assert.equal((await restored.get(guest)).round,2);
});
test('invalid moves and promotion attempts are rejected by the server',async()=>{
 const {service,host,invite,guest}=await setup();await service.join(invite,guest);
 await assert.rejects(service.submit(host,1,move(1,4,3,4)),isRoomError(422));
 await assert.rejects(service.submit(host,1,move(6,4,3,4)),isRoomError(422));
 await assert.rejects(service.submit(host,1,{...move(6,4,4,4),promotion:'q'}),isRoomError(422));
 assert.equal((await service.get(host)).myLocked,false);
});
test('both players landing on the same square lose both pieces',()=>{
 const b=Array.from({length:8},()=>Array(8).fill(null));
 b[4][3]=makePiece('W','r','left');b[4][5]=makePiece('B','r','right');
 const r=resolveRound(b,move(4,3,4,4),move(4,5,4,4));
 assert.equal(r.board[4][4],null);assert.equal(r.captures.length,2);assert.equal(r.outcome,'draw');
});
test('pieces capturing one another by swapping squares are both removed',()=>{
 const b=Array.from({length:8},()=>Array(8).fill(null));
 b[4][3]=makePiece('W','r','left');b[4][4]=makePiece('B','r','right');
 const r=resolveRound(b,move(4,3,4,4),move(4,4,4,3));
 assert.equal(r.board[4][3],null);assert.equal(r.board[4][4],null);assert.equal(r.outcome,'draw');
});
test('three consecutive double-pass rounds end as a draw',async()=>{
 const {service,host,invite,guest}=await setup();await service.join(invite,guest);
 for(let i=1;i<=3;i++){await service.submit(host,i,{pass:true});const s=await service.submit(guest,i,{pass:true});if(i<3)assert.equal(s.round,i+1);else assert.equal(s.outcome,'draw-pass');}
 await assert.rejects(service.submit(host,3,{pass:true}),isRoomError(409));
});
test('room expiration is enforced',async()=>{
 const {service,clock,host}=await setup();clock.now+=8*24*60*60*1000;
 await assert.rejects(service.get(host),isRoomError(410));
});
test('guest cannot submit before joining or using an invitation token',async()=>{
 const {service,host,invite}=await setup();await assert.rejects(service.submit(host,1,move(6,4,4,4)),isRoomError(409));
 await assert.rejects(service.get(invite),isRoomError(403));
});

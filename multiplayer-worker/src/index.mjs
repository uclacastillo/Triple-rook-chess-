/* Cloudflare Worker routes for the private, server-authoritative Triple Rook Chess rooms. */
import { DurableObject } from 'cloudflare:workers';
import {RoomService,RoomError,createToken} from './room.mjs';
const ROOM_ID=/^[A-Za-z0-9_-]{16,64}$/;
const MATCH_URL=/^\/v1\/rooms\/([A-Za-z0-9_-]{16,64})\/(state|join|moves)$/;
const MAX_BODY=4096;
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{
  status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...extra}
});
const fail=(code,msg)=>json({error:msg},code);
function allowedOrigin(origin,env){
  if(!origin)return true;
  const allowed=String(env.FRONTEND_ORIGIN||'https://triple-rook-chess.vercel.app').split(',').map(v=>v.trim());
  if(allowed.includes(origin))return true;
  // Exact local development origins only; do not trust arbitrary wildcard domains.
  return origin==='http://localhost:8765'||origin==='http://127.0.0.1:8765';
}
function addCors(response,origin){
  const h=new Headers(response.headers);if(origin)h.set('access-control-allow-origin',origin);
  h.set('vary','Origin');h.set('access-control-allow-methods','GET,POST,OPTIONS');
  h.set('access-control-allow-headers','Authorization,Content-Type');
  h.set('access-control-max-age','600');h.set('cache-control','no-store');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});
}
async function parseBody(request){
  const contentType=request.headers.get('content-type')||'';
  if(!contentType.startsWith('application/json'))throw new RoomError(415,'Send JSON requests.');
  if(Number(request.headers.get('content-length')||'0')>MAX_BODY)throw new RoomError(413,'Request is too large.');
  const text=await request.text();if(text.length>MAX_BODY)throw new RoomError(413,'Request is too large.');
  try{const data=JSON.parse(text);if(!data||typeof data!=='object'||Array.isArray(data))throw Error();return data;}catch{throw new RoomError(400,'Invalid JSON request.');}
}
function bearer(request){const auth=request.headers.get('authorization')||'';if(!auth.startsWith('Bearer '))throw new RoomError(401,'Your game session is missing.');return auth.slice(7);}
export class GameRoom extends DurableObject {
  constructor(ctx,env){super(ctx,env);this.service=new RoomService(ctx.storage);}
  async fetch(request){
    try {
      const url=new URL(request.url);
      if(url.pathname==='/internal/create'&&request.method==='POST'){
        const {id,hostToken,inviteToken}=await parseBody(request);
        if(!ROOM_ID.test(id))throw new RoomError(400,'Invalid game room ID.');
        const state=await this.service.create(id,hostToken,inviteToken);return json(state,201);
      }
      if(url.pathname==='/internal/join'&&request.method==='POST'){
        const {inviteToken,guestToken}=await parseBody(request);
        const state=await this.service.join(inviteToken,guestToken);return json(state);
      }
      if(url.pathname==='/internal/state'&&request.method==='GET')return json(await this.service.get(bearer(request)));
      if(url.pathname==='/internal/moves'&&request.method==='POST'){
        const {round,move}=await parseBody(request);
        return json(await this.service.submit(bearer(request),round,move));
      }
      return fail(404,'Endpoint not found.');
    }catch(e){if(e instanceof RoomError)return fail(e.status,e.message);return fail(500,'Unable to process this game request.');}
  }
}
export default {
  async fetch(request,env){
    const origin=request.headers.get('origin');
    if(!allowedOrigin(origin,env))return fail(403,'This origin is not allowed.');
    if(request.method==='OPTIONS')return addCors(new Response(null,{status:204}),origin);
    const finish=response=>addCors(response,origin);
    try{
      const url=new URL(request.url);
      if(url.pathname==='/v1/health'&&request.method==='GET')return finish(json({status:'ok',service:'triple-rook-multiplayer',version:1}));
      if(url.pathname==='/v1/rooms'&&request.method==='POST'){
        const body=await parseBody(request);
        if(Object.keys(body).length)throw new RoomError(400,'Creating a room does not require settings.');
        const id=createToken(16),hostToken=createToken(),inviteToken=createToken();
        const stub=env.GAME_ROOMS.getByName(id);
        const response=await stub.fetch(new Request('https://room/internal/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,hostToken,inviteToken})}));
        if(!response.ok)return finish(response);
        return finish(json({roomId:id,hostToken,inviteToken,state:await response.json()},201));
      }
      const match=MATCH_URL.exec(url.pathname);
      if(!match)return finish(fail(404,'Endpoint not found.'));
      const [,id,action]=match;
      if(!ROOM_ID.test(id))return finish(fail(400,'Invalid game room ID.'));
      const stub=env.GAME_ROOMS.getByName(id);
      if(action==='join'&&request.method==='POST'){
        const body=await parseBody(request);const guestToken=createToken();
        const response=await stub.fetch(new Request('https://room/internal/join',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({inviteToken:body.inviteToken,guestToken})}));
        if(!response.ok)return finish(response);
        return finish(json({guestToken,state:await response.json()}));
      }
      if(action==='state'&&request.method==='GET'){
        const response=await stub.fetch(new Request('https://room/internal/state',{headers:{authorization:'Bearer '+bearer(request)}}));
        return finish(response);
      }
      if(action==='moves'&&request.method==='POST'){
        const body=await parseBody(request);
        const response=await stub.fetch(new Request('https://room/internal/moves',{method:'POST',headers:{authorization:'Bearer '+bearer(request),'content-type':'application/json'},body:JSON.stringify({round:body.round,move:body.move})}));
        return finish(response);
      }
      return finish(fail(405,'Method not allowed.'));
    }catch(e){return finish(e instanceof RoomError?fail(e.status,e.message):fail(500,'Unable to contact the game room.'));}
  }
};

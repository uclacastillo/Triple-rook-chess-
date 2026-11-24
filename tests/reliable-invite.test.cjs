/* Regression tests for the host invitation flow.
 * These intentionally render the board before the room snapshot is loaded,
 * matching the startup crash observed on iPhone Safari.
 */
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'..','assets','reliable-multiplayer.js'),'utf8');

function setup({blockSessionStorage=false}={}) {
  class Element {
    constructor(id) {
      this.id=id;this.hidden=true;this.disabled=false;this.value='';this.textContent='';
      this.style={};this.dataset={};this.children=[];this.className='';
      this.classList={toggle(){},add(){},remove(){},contains(){return false}};
      this.parentElement=null;
    }
    setAttribute(k,v){this[k]=v}
    appendChild(x){this.children.push(x);return x}
    insertBefore(x){this.children.push(x);return x}
    insertAdjacentElement(p,x){this.children.push(x);return x}
    replaceChildren(...children){this.children=children}
    querySelector(s){this._named||=Object.create(null);return this._named[s]||=new Element(s)}
    closest(){return nodes.boardArea}
  }
  const nodes=new Proxy(Object.create(null),{get(obj,k){return obj[k]||=new Element(k)}});
  const created=[];
  nodes.menu.hidden=false;nodes.game.hidden=true;
  const saved=new Map();
  const persistent={getItem(k){return saved.get(k)||null},setItem(k,v){saved.set(k,v)}};
  const sessionStorage=blockSessionStorage?{
    getItem(){throw Error('Session storage disabled')},
    setItem(){throw Error('Session storage disabled')}
  }:persistent;
  const board=Array.from({length:8},()=>Array(8).fill(null));
  const state={roomId:'abcdefghijklmnopQRSTU',role:'host',revision:1,round:1,board,
    history:[{round:0,board,whiteLabel:'—',blackLabel:'—',events:['Starting position']}],
    last:null,lastResult:null,consecutivePass:0,outcome:null,guestJoined:false,
    opponentConnected:false,opponentLocked:false,myLocked:false,expiresAt:Date.now()+100000};
  const window={TRIPLE_ROOK_API_URL:'https://worker.example.test'};
  const game={stage:'menu',history:[],viewIndex:-1,board,round:1,selected:null,
    choices:[],pending:null,online:false,role:null};
  const ctx={window,game,URL,URLSearchParams,AbortSignal,console,
    setTimeout:()=>1,clearTimeout:()=>{},
    location:{origin:'https://triple-rook-chess.vercel.app',pathname:'/',search:'',href:'https://triple-rook-chess.vercel.app/'},
    history:{replaceState(){}},
    document:{hidden:false,createElement:k=>{const el=new Element(k);created.push(el);return el},
      querySelector:s=>nodes[s==='#menu'?'menu':s],getElementById:k=>nodes[k],addEventListener(){}},
    localStorage:persistent,sessionStorage,
    navigator:{clipboard:{writeText:async()=>{}}},
    fetch:async url=>({ok:true,status:url.endsWith('/v1/rooms')?201:200,
      json:async()=>url.endsWith('/v1/rooms')?{
        roomId:state.roomId,hostToken:'host_'+'a'.repeat(40),inviteToken:'invite_'+'b'.repeat(40),state
      }:state}),
    render:()=>{},lock:()=>{},
    home:()=>{game.stage='menu';nodes.menu.hidden=false;nodes.game.hidden=true},
    show:(id,visible)=>{nodes[id].hidden=!visible},
    startGame:mode=>{game.mode=mode;game.stage='white';game.history=[{round:0,board}];
      game.viewIndex=0;nodes.menu.hidden=true;nodes.game.hidden=false;ctx.render();},
    showWinner:()=>{},
  };
  vm.createContext(ctx);
  vm.runInContext(script,ctx,{filename:'reliable-multiplayer.js'});
  return {ctx,nodes,created};
}

for (const blockSessionStorage of [false,true]) {
  test('Host invite dialog opens and can reopen; sessionStorage blocked='+blockSessionStorage,async()=>{
    const {ctx,nodes,created}=setup({blockSessionStorage});
    await nodes.friendButton.onclick();
    assert.equal(ctx.game.stage,'waiting');
    assert.equal(nodes.handoff.hidden,false,'Invitation dialog must appear immediately');
    const link=nodes.inviteLink.value;
    assert.match(link,/^https:\/\/triple-rook-chess\.vercel\.app\/\?room=[A-Za-z0-9_-]+#invite=[A-Za-z0-9_-]+$/);
    const share=created[0].querySelector('.room-share');
    assert.equal(share.hidden,false,'Invite friend must be visible while host waits');
    nodes.handoff.hidden=true;
    share.onclick();
    assert.equal(nodes.handoff.hidden,false,'Invite friend must reopen the dialog');
    assert.equal(nodes.inviteLink.value,link,'Reopened invitation must use the same secret');
    assert.equal(ctx.window.TripleRookReliableMultiplayer.getStatus().round,1);
  });
}

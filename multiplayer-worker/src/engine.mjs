/*
 * Triple Rook Chess rule engine — server-side mirror of Noah's game rules.
 * A king is the third ORIGINAL rook; its movement is rook movement.
 * This module is dependency-free and tested under Node and Cloudflare Workers.
 */
const LETTERS = 'abcdefgh';
export const same = (a,b) => !!a && !!b && a.r === b.r && a.c === b.c;
export const other = side => side === 'W' ? 'B' : 'W';
export const squareName = (r,c) => LETTERS[c] + (8-r);
export const makePiece = (side,type,life=null) => ({side,type,life});
const NAMES = {p:'Pawn',r:'Rook',n:'Knight',b:'Bishop',q:'Queen',k:'Crown rook'};
const at = (r,c) => r>=0 && r<8 && c>=0 && c<8;
export function initialBoard(){
  const board=Array.from({length:8},()=>Array(8).fill(null));
  const back=['r','n','b','q','k','b','n','r'];
  for(let c=0;c<8;c++){
    const life=c===0?'left':c===7?'right':c===4?'crown':null;
    board[0][c]=makePiece('B',back[c],life);
    board[1][c]=makePiece('B','p');
    board[6][c]=makePiece('W','p');
    board[7][c]=makePiece('W',back[c],life);
  }
  return board;
}
export function movesFor(board,r,c){
  const p=board[r]?.[c]; if(!p)return [];
  const {side}=p, type=p.type, out=[];
  const add=(rr,cc)=>{if(!at(rr,cc))return false;const there=board[rr][cc];if(there&&there.side===side)return false;out.push({from:{r,c},to:{r:rr,c:cc}});return !there;};
  if(type==='p'){
    const d=side==='W'?-1:1,home=side==='W'?6:1;
    if(at(r+d,c)&&!board[r+d][c]){
      out.push({from:{r,c},to:{r:r+d,c}});
      if(r===home&&!board[r+2*d][c])out.push({from:{r,c},to:{r:r+2*d,c}});
    }
    for(const dc of [-1,1])if(at(r+d,c+dc)&&board[r+d][c+dc]&&board[r+d][c+dc].side!==side)out.push({from:{r,c},to:{r:r+d,c:c+dc}});
    return out;
  }
  if(type==='n'){
    for(const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])add(r+dr,c+dc);
    return out;
  }
  const directions=[];
  if(type==='r'||type==='k'||type==='q')directions.push([-1,0],[1,0],[0,-1],[0,1]);
  if(type==='b'||type==='q')directions.push([-1,-1],[-1,1],[1,-1],[1,1]);
  for(const [dr,dc] of directions){let rr=r+dr,cc=c+dc;while(at(rr,cc)){if(!add(rr,cc))break;rr+=dr;cc+=dc}}
  return out;
}
export function alive(board,side){const out=new Set();for(const row of board)for(const p of row)if(p?.side===side&&p.life)out.add(p.life);return out;}
export function formatMove(move,piece){
  if(move?.pass)return 'Pass';
  return (piece?NAMES[piece.type]+' ':'')+squareName(move.from.r,move.from.c)+' → '+squareName(move.to.r,move.to.c)+(move.promotion?' = '+NAMES[move.promotion]:'');
}
export function validateMove(board,side,input){
  if(!input || typeof input!=='object'||Array.isArray(input))throw new Error('Move is required.');
  if(input.pass===true && Object.keys(input).every(k=>k==='pass'))return {pass:true};
  const {from,to,promotion}=input;
  if(!from||!to||!Number.isInteger(from.r)||!Number.isInteger(from.c)||!Number.isInteger(to.r)||!Number.isInteger(to.c)||!at(from.r,from.c)||!at(to.r,to.c))throw new Error('Choose valid board squares.');
  const piece=board[from.r][from.c];
  if(!piece||piece.side!==side)throw new Error('Select one of your own pieces.');
  const valid=movesFor(board,from.r,from.c).some(m=>same(m.to,to));
  if(!valid)throw new Error('That move is not legal from the current board.');
  const promotes=piece.type==='p' && (to.r===0||to.r===7);
  if(promotion!=null && (!promotes || !['q','r','b','n'].includes(promotion)))throw new Error('That promotion is not permitted.');
  return {from:{r:from.r,c:from.c},to:{r:to.r,c:to.c},...(promotes?{promotion:promotion||'q'}:{})};
}
export function resolveRound(board,wMove,bMove){
  const old=board,updated=board.map(row=>row.map(p=>p?{...p}:null));
  const active=[], captures=[], events=[];
  for(const [side,m] of [['W',wMove],['B',bMove]]){
    if(m&&!m.pass)active.push({side,move:m,piece:old[m.from.r][m.from.c]});
  }
  for(const entry of active)updated[entry.move.from.r][entry.move.from.c]=null;
  let collision=false;
  const sameDestination=active.length===2&&same(active[0].move.to,active[1].move.to);
  const mutualCapture=active.length===2&&same(active[0].move.to,active[1].move.from)&&same(active[1].move.to,active[0].move.from);
  if(sameDestination||mutualCapture){
    collision=true;
    for(const ent of active)captures.push({victim:ent.piece,by:mutualCapture?'mutual-capture':'collision'});
    events.push(mutualCapture?'Mutual capture! Both moving pieces captured each other, so both were lost.':'Both players chose '+squareName(active[0].move.to.r,active[0].move.to.c)+'. Both moving pieces were lost!');
  } else {
    for(const ent of active){const {r,c}=ent.move.to;const victim=updated[r][c];if(victim&&victim.side!==ent.side){captures.push({victim,by:ent.side});updated[r][c]=null;}}
    for(const ent of active){const {r,c}=ent.move.to;let moved=ent.piece;if(ent.move.promotion)moved={...moved,type:ent.move.promotion};updated[r][c]=moved;}
  }
  for(const x of captures){if(x.victim?.life){const lost=x.victim.side==='W'?'Blue':'Red';const capturedBy=x.by==='W'?'Blue':x.by==='B'?'Red':null;const detail=x.victim.life==='crown'?' (the king-rook)':'';events.push(capturedBy?`👍 ${capturedBy} captured ${lost}’s starting rook${detail}! ☠️ ${lost} lost a rook.`:`☠️ ${lost} lost a starting rook${detail}!`);}}
  const wAlive=alive(updated,'W').size,bAlive=alive(updated,'B').size;
  let outcome=null;
  if(wAlive===0&&bAlive===0)outcome='draw';else if(wAlive===0)outcome='B';else if(bAlive===0)outcome='W';
  return {board:updated,captures,events,collision,outcome};
}
export function performRound(room){
  const current=room.board;
  const wMove=room.moves.W,bMove=room.moves.B;
  const wPiece=wMove.pass?null:current[wMove.from.r][wMove.from.c];
  const bPiece=bMove.pass?null:current[bMove.from.r][bMove.from.c];
  const result=resolveRound(current,wMove,bMove);
  const bothPass=wMove.pass&&bMove.pass;
  room.consecutivePass=bothPass?room.consecutivePass+1:0;
  if(room.consecutivePass>=3)result.outcome='draw-pass';
  const events=result.events.length?result.events:['No original rooks lost this round.'];
  room.history.push({round:room.round,board:result.board.map(row=>row.map(p=>p?{...p}:null)),whiteLabel:formatMove(wMove,wPiece),blackLabel:formatMove(bMove,bPiece),events});
  room.last=[wMove,bMove].filter(m=>!m.pass);
  room.lastResult=result;
  room.board=result.board;
  room.outcome=result.outcome;
  if(!result.outcome)room.round++;
  room.moves={W:null,B:null};
  return room;
}

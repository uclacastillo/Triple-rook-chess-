/*
 * Noah's Triple Rook Chess — Character Crew art layer.
 * Cosmetic enhancement only: moves, online synchronization, and win conditions
 * continue to use the original game engine in index.html.
 */
(function(){
 'use strict';
 const ART_ROOT='assets/character-crew/';
 const STAGE_WIDTH=1200,STAGE_HEIGHT=1120;
 let mode='character';
 try{if(localStorage.getItem('trc-art-view')==='classic')mode='classic'}catch(e){}
 // Exact geometry used to draw board-2.5d.webp, from back edge to front edge.
 function edge(row){const t=row/8;return {left:162-87*t,right:1038+87*t,y:145+777*Math.pow(t,1.13)}}
 function vertex(row,col){const e=edge(row);return{x:e.left+(e.right-e.left)*col/8,y:e.y}}
 function pct(n,scale){return (100*n/scale).toFixed(4)+'%'}
 function tileShape(row,col){return [[row,col],[row,col+1],[row+1,col+1],[row+1,col]].map(([r,c])=>{const a=vertex(r,c);return pct(a.x,STAGE_WIDTH)+' '+pct(a.y,STAGE_HEIGHT)}).join(',')}
 function gameArtPath(piece,reverse){
  const team=piece.side==='W'?'blue':'red';
  const kind=piece.type==='k'?'king-rook':({p:'pawn',n:'knight',b:'bishop',q:'queen',r:'rook'})[piece.type];
  return ART_ROOT+team+'-'+kind+'-'+(reverse?'back':'front')+'.webp';
 }
 const classicRender=renderBoard;
 function renderCharacters(){
  const container=document.getElementById('board');
  container.replaceChildren();container.classList.add('character-view');
  const state=(Array.isArray(game.history)?game.history[game.viewIndex]?.board:null)||game.board;
  const flipped=orientation();
  document.getElementById('boardPerspective').textContent=(flipped?'Red':'Blue')+' at bottom · 2.5D';
  const clickable=document.createDocumentFragment(),sprites=document.createDocumentFragment();
  for(let rr=0;rr<8;rr++)for(let cc=0;cc<8;cc++){
   const r=flipped?7-rr:rr,c=flipped?7-cc:cc,p=state[r][c];
   const button=document.createElement('button');
   button.type='button';button.className='char-square';
   button.style.clipPath='polygon('+tileShape(rr,cc)+')';
   button.dataset.square=squareName(r,c);
   button.setAttribute('aria-label',squareName(r,c)+' '+(p?(p.side==='W'?'Blue ':'Red ')+NAMES[p.type]:'empty square'));
   const isSelected=game.selected&&same(game.selected,{r,c});
   if(isSelected)button.classList.add('selected');
   const isTarget=game.choices.some(x=>same(x.to,{r,c}));
   if(isTarget)button.classList.add(p?'can-capture':'possible');
   if(game.last){if(game.last.some(x=>x.from&&same(x.from,{r,c})))button.classList.add('last-from');if(game.last.some(x=>x.to&&same(x.to,{r,c})))button.classList.add('last-to')}
   button.addEventListener('click',()=>squareClick(r,c));clickable.appendChild(button);
   if(p){
    const left=vertex(rr+1,cc),right=vertex(rr+1,cc+1),top=vertex(rr,cc);
    const tileWidth=right.x-left.x;
    const yBase=left.y-(left.y-top.y)*.13;
    const img=document.createElement('img');
    const localBack=(flipped?p.side==='B':p.side==='W');
    img.src=gameArtPath(p,localBack);img.alt=(p.side==='W'?'Blue ':'Red ')+NAMES[p.type]+' '+(localBack?'rear':'front')+' view';
    img.className='char-sprite'+(isSelected?' selected':'')+(p.life==='crown'?' is-royal':'');
    img.style.left=pct((left.x+right.x)/2,STAGE_WIDTH);
    img.style.top=pct(yBase,STAGE_HEIGHT);
    // Pawns stay subordinate in height; king-rook and queen have a hero silhouette.
    const magnify=({'p':1.13,'n':1.37,'b':1.34,'q':1.33,'k':1.37,'r':1.30})[p.type];
    img.style.width=pct(tileWidth*magnify,STAGE_WIDTH);
    img.style.zIndex=String(9+rr);
    img.draggable=false;img.setAttribute('aria-hidden','true');
    sprites.appendChild(img);
   }
  }
  container.appendChild(clickable);container.appendChild(sprites);
 }
 renderBoard=function(){
  const el=document.getElementById('board');
  if(mode!=='character') {el.classList.remove('character-view');return classicRender()}
  return renderCharacters();
 };
 const toggle=document.createElement('button');toggle.type='button';toggle.id='characterViewToggle';toggle.className='pill-btn';
 function syncToggle(){toggle.textContent=mode==='character'?'🎭 2.5D On':'♟ Classic';toggle.setAttribute('aria-pressed',String(mode==='character'));toggle.title=mode==='character'?'Switch to classic top-down board':'Switch to Character Crew view'}
 syncToggle();toggle.addEventListener('click',()=>{
  mode=mode==='character'?'classic':'character';
  try{localStorage.setItem('trc-art-view',mode)}catch(e){}
  syncToggle();if(game.stage!=='menu')render();
 });
 const actions=document.querySelector('.top-actions');if(actions)actions.insertBefore(toggle,actions.firstChild);
 // The view switch is visual-only, safe for both online roles and game history.
 window.TripleRookCharacterCrew={getView:()=>mode,setView:v=>{mode=v==='classic'?'classic':'character';syncToggle();if(game.stage!=='menu')render()}};
})();

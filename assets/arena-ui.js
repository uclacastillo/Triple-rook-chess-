/* Triple Rook Chess — Character Crew Arena: visual HUD only.
   Existing game engine, move selection, online synchronization, and history stay authoritative. */
(function(){
 'use strict';
 const blue='assets/character-crew/blue-king-rook-front.webp';
 const red='assets/character-crew/red-king-rook-front.webp';
 const artRoot='assets/character-crew/';
 const qs=id=>document.getElementById(id);
 const area=document.querySelector('.board-area');
 const top=document.querySelector('.top');
 if(!area||!top||!qs('board')||!qs('lockButton'))return;
 const title=document.createElement('img');
 title.className='arena-title';title.src='assets/arena-title.webp';title.alt='Triple Rook Chess';title.decoding='async';
 top.insertBefore(title,top.querySelector('.top-actions'));
 const match=document.createElement('div');match.className='arena-matchbar';match.setAttribute('aria-label','Players and rook lives');
 match.innerHTML=`
  <div class="arena-team blue"><span class="arena-avatar"><img src="${blue}" alt="" aria-hidden="true"></span><span class="arena-team-info"><strong id="arenaBlueName">Blue</strong><small>🔵 <span id="arenaBlueLives">3 of 3 rooks</span></small></span></div>
  <div class="arena-versus"><span class="shield">VS</span><small id="arenaRound">Round 1</small></div>
  <div class="arena-team red"><span class="arena-avatar"><img src="${red}" alt="" aria-hidden="true"></span><span class="arena-team-info"><strong id="arenaRedName">Red</strong><small>🔴 <span id="arenaRedLives">3 of 3 rooks</span></small></span></div>`;
 area.insertBefore(match,area.firstChild);
 const footer=document.createElement('div');footer.className='arena-footer';
 const prompt=document.createElement('div');prompt.className='arena-prompt';
 prompt.setAttribute('role','status');prompt.setAttribute('aria-live','polite');
 prompt.innerHTML=`<span class="arena-portrait"><img id="arenaPieceImg" src="${blue}" alt="" aria-hidden="true"></span><span class="arena-prompt-main"><h3 id="arenaPromptTitle">Choose a piece</h3></span><span class="arena-target-count"><i class="arena-dot" aria-hidden="true"></i><span class="arena-count" id="arenaCount">0</span><span id="arenaCountLabel">Moves</span></span>`;
 const selection=qs('selectionText');prompt.querySelector('.arena-prompt-main').appendChild(selection);
 footer.appendChild(prompt);
 const action=qs('lockButton').closest('.action-stack');
 if(action)footer.appendChild(action);
 const waiting=document.createElement('div');waiting.className='arena-waiting';waiting.textContent='Waiting for the other player…';
 if(action)action.appendChild(waiting);
 const help=document.createElement('div');help.className='arena-button-key';help.id='arenaButtonHelp';help.textContent='↶ Change move   ·   ✓ Lock in secretly   ·   ⏭ Pass';
 footer.appendChild(help);
 area.appendChild(footer);
 const change=qs('changeButton'),pass=qs('passButton'),lock=qs('lockButton'),reveal=qs('revealButton');
 change?.setAttribute('aria-label','Clear selected move');change?.setAttribute('title','Change or clear selected move');
 pass?.setAttribute('aria-label','Pass this round');pass?.setAttribute('title','Pass this round');
 const homeButton=qs('homeButton'),rulesButton=qs('rulesButton');
 homeButton?.setAttribute('aria-label','Leave game and return to menu');homeButton?.setAttribute('title','Back to menu');
 rulesButton?.setAttribute('title','Read the game rules');rulesButton?.setAttribute('aria-label','Game rules');
 const viewButton=qs('characterViewToggle');
 viewButton?.setAttribute('title','Toggle angled Character Crew and Classic board views');
 function spriteFor(piece,front){
  if(!piece)return blue;
  const t=({p:'pawn',n:'knight',b:'bishop',q:'queen',r:'rook',k:'king-rook'})[piece.type]||'pawn';
  return artRoot+(piece.side==='W'?'blue':'red')+'-'+t+'-'+(front?'front':'back')+'.webp';
 }
 function boardPoint(row,col){
  const t=row/8, left=162-87*t, right=1038+87*t;
  return {x:left+(right-left)*col/8,y:145+777*Math.pow(t,1.13)};
 }
 function showMarkers(){
  const board=qs('board');
  if(!board.classList.contains('character-view'))return;
  board.querySelectorAll('.arena-move-markers').forEach(n=>n.remove());
  if(!game.choices?.length)return;
  const overlay=document.createElement('div');overlay.className='arena-move-markers';overlay.setAttribute('aria-hidden','true');
  const flip=(typeof orientation==='function'?orientation():false);
  for(const m of game.choices){
   const rr=flip?7-m.to.r:m.to.r,cc=flip?7-m.to.c:m.to.c;
   const xy=boardPoint(rr+.54,cc+.5);
   const p=game.board[m.to.r]?.[m.to.c];
   const dot=document.createElement('span');dot.className='arena-move-dot'+(p?' capture':'');
   dot.style.left=(xy.x/12).toFixed(3)+'%';dot.style.top=(xy.y/11.2).toFixed(3)+'%';
   overlay.appendChild(dot);
  }
  board.appendChild(overlay);
 }
 function updateArena(){
  const active=game.stage!=='menu'&&!qs('game').hidden;
  document.body.classList.toggle('arena-active',active);
  if(!active)return;
  const blueLives=typeof alive==='function'?alive(game.board,'W').size:3;
  const redLives=typeof alive==='function'?alive(game.board,'B').size:3;
  qs('arenaBlueLives').textContent=blueLives+' of 3 rooks';
  qs('arenaRedLives').textContent=redLives+' of 3 rooks';
  qs('arenaRound').textContent='Round '+game.round;
  qs('arenaBlueName').textContent=game.mode==='solo'?'You · Blue':'Blue';
  qs('arenaRedName').textContent=game.mode==='solo'?'Computer':'Red';
  const waitingStage=game.stage==='waiting';
  footer.classList.toggle('waiting',waitingStage);
  const playable=game.stage==='white'||game.stage==='black';
  if(lock&&playable){const who=game.stage==='black'?'Red':'Blue';lock.textContent='✓ Lock In Move';lock.title='Lock in '+who+'’s move secretly';lock.setAttribute('aria-label','Lock in '+who+'’s move secretly');}
  if(reveal){reveal.textContent='⚔ Reveal Both Moves';}
  if(change&&playable)change.disabled=!(game.pending||game.selected);
  const p=game.selected?game.board[game.selected.r]?.[game.selected.c]:game.pending&&!game.pending.pass?game.board[game.pending.from.r]?.[game.pending.from.c]:null;
  const type=p?(typeof NAMES==='object'?NAMES[p.type]:'Piece'):null;
  const pt=qs('arenaPromptTitle');
  if(game.stage==='ended')pt.textContent='Game complete';
  else if(waitingStage)pt.textContent='Move sent securely';
  else if(game.stage==='reveal')pt.textContent='Both moves are ready';
  else if(game.pending?.pass)pt.textContent='Passing this round';
  else if(game.pending)pt.textContent=type+' move selected';
  else if(game.selected)pt.textContent=type+' selected';
  else pt.textContent=(game.stage==='black'?'Red':'Blue')+', choose a move';
  const face=p?(typeof orientation==='function'&&orientation()?p.side==='B':p.side==='W'):true;
  const image=qs('arenaPieceImg');image.src=spriteFor(p,face);image.alt='';
  const count=game.choices?.length||0;
  qs('arenaCount').textContent=String(count);
  qs('arenaCountLabel').textContent=count===1?'Move':'Moves';
  qs('arenaButtonHelp').textContent=waitingStage?'Your move is hidden until both players finish':game.stage==='reveal'?'Reveal both players’ moves together':'↶ Change   ·   ✓ Lock in secretly   ·   ⏭ Pass';
  showMarkers();
 }
 const oldRender=render;
 render=function(){const val=oldRender.apply(this,arguments);updateArena();return val;};
 const oldHome=home;
 home=function(){const v=oldHome.apply(this,arguments);updateArena();return v;};
 const oldStart=startGame;
 startGame=function(){const v=oldStart.apply(this,arguments);updateArena();return v;};
 updateArena();
 window.TripleRookArena={update:updateArena};
})();

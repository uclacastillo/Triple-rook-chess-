/* Triple Rook Chess — 4 fully functional cosmetic sets. No changes to rules or online protocol. */
(function(){
 'use strict';
 const STYLES=[
  {id:'character-crew',name:'Character Crew',subtitle:'Playful heroes and tiny castle friends'},
  {id:'neo-arena',name:'Neo Arena',subtitle:'Chrome, electric blue and vivid red'},
  {id:'mythic-quest',name:'Mythic Quest',subtitle:'Enchanted gold and jewel-tone details'},
  {id:'atelier-modern',name:'Atelier Modern',subtitle:'Sculpted marble, ebony and warm brass'}
 ];
 const STYLE_IDS=new Set(STYLES.map(s=>s.id));
 const $=id=>document.getElementById(id);
 let applied='character-crew';
 try{const saved=localStorage.getItem('trc-piece-style-v1');if(STYLE_IDS.has(saved))applied=saved}catch(_){}
 let pending=applied;
 document.body.dataset.pieceStyle=applied;
 const oldRender=render;
 const menu=$('menu');
 const imageBase=(style)=>style==='character-crew'?'assets/character-crew/':'assets/styles/'+style+'/';
 const art=(style,team,kind,angle)=>imageBase(style)+team+'-'+kind+'-'+angle+'.webp';
 const preview=style=>'assets/style-previews/'+style+'.webp';
 function spriteName(img){
  if(!img)return null;
  let basename=img.dataset.baseName;
  if(!basename){basename=(img.getAttribute('src')||'').split('/').pop().split('?')[0];if(/^(blue|red)-(pawn|knight|bishop|queen|rook|king-rook)-(front|back)\.webp$/.test(basename))img.dataset.baseName=basename;}
  return /^(blue|red)-(pawn|knight|bishop|queen|rook|king-rook)-(front|back)\.webp$/.test(basename)?basename:null;
 }
 function paintGame(){
  // The game engine and its 64-square hit geometry are authoritative. Only switch src files.
  const board=$('board');
  if(board?.classList.contains('character-view')){
   board.querySelectorAll('img.char-sprite').forEach(img=>{
    const name=spriteName(img);
    if(!name)return;
    const url=imageBase(applied)+name;
    if(!img.getAttribute('src')?.endsWith(url))img.src=url;
   });
  }
  const imgs=document.querySelectorAll('.arena-avatar img,#arenaPieceImg');
  imgs.forEach(img=>{
   const name=spriteName(img);
   if(name)img.src=imageBase(applied)+name;
  });
  // When switching the piece set while a game is in progress, do not change turn, board, or history.
 }
 render=function(){const val=oldRender.apply(this,arguments);paintGame();return val};
 function styleCard(s,klass){
  const button=document.createElement('button');button.type='button';button.className='style-card '+klass;button.dataset.style=s.id;
  button.setAttribute('aria-label',s.name+' piece set');button.setAttribute('aria-pressed',String(applied===s.id));
  const img=document.createElement('img');img.src=preview(s.id);img.alt='';img.loading='lazy';img.decoding='async';
  const text=document.createElement('span');text.className='style-label';text.textContent=s.name;
  const check=document.createElement('span');check.className='style-check';check.textContent='✓';check.setAttribute('aria-hidden','true');
  button.append(img,text,check);return button;
 }
 function setCardStates(){
  document.querySelectorAll('.style-choices .style-card').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.style===applied)));
  document.querySelectorAll('.style-popup-grid .style-card').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.style===pending)));
 }
 const homeShelf=document.createElement('section');homeShelf.className='style-shelf';homeShelf.id='styleShelf';homeShelf.setAttribute('aria-label','Choose your chess piece style');
 const shelfTitle=document.createElement('div');shelfTitle.className='style-shelf-head';
 shelfTitle.innerHTML='<h2 class="style-shelf-title">Choose your piece style</h2>';
 const explore=document.createElement('button');explore.type='button';explore.className='style-explore';explore.id='showStyleGallery';explore.textContent='See all 4 →';
 shelfTitle.append(explore);
 const homeCards=document.createElement('div');homeCards.className='style-choices';homeCards.setAttribute('aria-label','Available piece sets');
 const homeStatus=document.createElement('div');homeStatus.className='style-status';homeStatus.id='styleStatus';homeStatus.setAttribute('aria-live','polite');
 homeStatus.textContent=STYLES.find(s=>s.id===applied).name+' selected';
 STYLES.forEach(s=>{const card=styleCard(s,'home-choice');card.addEventListener('click',()=>chooseStyle(s.id));homeCards.append(card)});
 const note=document.createElement('p');note.className='style-note';note.textContent='✦ Only the artwork changes—not Noah’s rules.';
 homeShelf.append(shelfTitle,homeCards,note,homeStatus);
 const divider=document.createElement('div');divider.className='style-divider';divider.setAttribute('aria-hidden','true');divider.textContent='♜';
 const modeGrid=menu.querySelector('.mode-grid');
 const originalRules=menu.querySelector('.mini-rules');
 if(modeGrid){
  const solo=$('soloButton'),online=$('friendButton');
  for(const [btn,label] of [[solo,'Play vs Computer'],[online,'Play Online']]){
   if(!btn)continue;
   const cue=document.createElement('span');cue.className='home-play';cue.append(document.createTextNode(label+' '));
   const arrow=document.createElement('span');arrow.className='chevron';arrow.textContent='›';arrow.setAttribute('aria-hidden','true');cue.append(arrow);btn.append(cue);
  }
  if(online){const p=online.querySelector('p');if(p)p.textContent='Invite a friend with a link. Play together on two devices.';}
  menu.classList.add('style-home-menu');
  modeGrid.insertAdjacentElement('afterend',divider);
  divider.insertAdjacentElement('afterend',homeShelf);
  homeShelf.insertAdjacentElement('afterend',originalRules);
 }
 // Real modal with an angled board preview, using each of the 24 individual assets.
 const overlay=document.createElement('div');overlay.id='styleOverlay';overlay.className='style-overlay';overlay.hidden=true;
 overlay.innerHTML=`
 <section class="style-dialog" role="dialog" aria-modal="true" aria-labelledby="styleDialogTitle" aria-describedby="styleDialogHelp">
  <header class="style-dialog-head"><div><h2 id="styleDialogTitle">Choose your piece style</h2><p id="styleDialogHelp">Preview the set on the board. The rules stay the same.</p></div><button type="button" class="style-close" id="styleDialogClose" aria-label="Close style picker">×</button></header>
  <div class="style-scroll"><div class="style-preview-top"><strong id="stylePreviewName">Character Crew</strong><span id="stylePreviewDescription">Playful 3D heroes</span></div><div id="stylePreviewBoard" class="style-preview-stage" aria-label="Angled board with a preview of the selected chess pieces"></div>
  <p class="style-popup-title">Four sets to explore</p><div id="stylePopupGrid" class="style-popup-grid"></div></div>
  <footer class="style-dialog-foot"><button type="button" id="styleCancel" class="style-cancel">Cancel</button><button type="button" id="styleUse" class="style-use">✓ Use Character Crew</button></footer>
 </section>`;
 document.body.appendChild(overlay);
 const popupGrid=$('stylePopupGrid');
 STYLES.forEach(s=>{const card=styleCard(s,'popup-choice');card.addEventListener('click',()=>{pending=s.id;paintPreview();setCardStates()});popupGrid.append(card)});
 const boardPreview=$('stylePreviewBoard');
 // Same 2.5D board projection as the actual game. Opposite teams face one another.
 function edge(row){const t=row/8;return{left:162-87*t,right:1038+87*t,y:145+777*Math.pow(t,1.13)}}
 function vertex(row,col){const e=edge(row);return{x:e.left+(e.right-e.left)*col/8,y:e.y}}
 const lineup=[
  ['red','rook','front',0,0],['red','queen','front',0,3],['red','king-rook','front',0,4],['red','knight','front',0,7],
  ['red','pawn','front',1,2],['red','pawn','front',1,5],
  ['blue','pawn','back',6,2],['blue','pawn','back',6,5],
  ['blue','rook','back',7,0],['blue','knight','back',7,2],['blue','queen','back',7,3],['blue','king-rook','back',7,4],['blue','bishop','back',7,6]
 ];
 const stageSprites=[];
 lineup.forEach(([team,kind,face,rr,cc])=>{
  const a=vertex(rr+1,cc),b=vertex(rr+1,cc+1),t=vertex(rr,cc);
  const img=document.createElement('img');img.alt='';img.setAttribute('aria-hidden','true');img.draggable=false;
  img.style.left=(100*(a.x+b.x)/2/1200).toFixed(3)+'%';img.style.top=(100*(a.y-(a.y-t.y)*.13)/1120).toFixed(3)+'%';
  const size=(b.x-a.x)*({rook:.8,knight:.86,queen:.88,'king-rook':.9,pawn:.66,bishop:.86}[kind]);
  img.style.width=(size/12).toFixed(3)+'%';
  img.style.zIndex=String(9+rr);
  boardPreview.append(img);stageSprites.push({img,team,kind,face});
 });
 let originFocus=null;
 function paintPreview(){
  const s=STYLES.find(x=>x.id===pending);$('stylePreviewName').textContent=s.name;$('stylePreviewDescription').textContent=s.subtitle;$('styleUse').textContent='✓ Use '+s.name;
  stageSprites.forEach(({img,team,kind,face})=>{img.src=art(pending,team,kind,face)});
 }
 function chooseStyle(id){
  if(!STYLE_IDS.has(id))return;
  applied=id;document.body.dataset.pieceStyle=id;
  try{localStorage.setItem('trc-piece-style-v1',id)}catch(_){}
  setCardStates();homeStatus.textContent=STYLES.find(s=>s.id===id).name+' selected';
  if(game.stage!=='menu')render();
 }
 function openPicker(){
  pending=applied;originFocus=document.activeElement;
  overlay.hidden=false;document.body.classList.add('style-modal-open');
  paintPreview();setCardStates();$('styleDialogClose').focus();
 }
 function closePicker(){overlay.hidden=true;document.body.classList.remove('style-modal-open');originFocus?.focus?.()}
 explore.addEventListener('click',openPicker);
 $('styleDialogClose').addEventListener('click',closePicker);
 $('styleCancel').addEventListener('click',closePicker);
 $('styleUse').addEventListener('click',()=>{chooseStyle(pending);closePicker()});
 overlay.addEventListener('click',ev=>{if(ev.target===overlay)closePicker()});
 overlay.addEventListener('keydown',ev=>{
  if(ev.key==='Escape'){ev.stopPropagation();closePicker();return}
  if(ev.key!=='Tab')return;
  const focusable=[...overlay.querySelectorAll('button:not([disabled])')];
  if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];
  if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last.focus()}
  else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus()}
 });
 // Surface the same visual picker during play without changing the turn state.
 const toolbar=document.querySelector('.top-actions');const toggle=$('characterViewToggle');
 if(toolbar&&toggle){
  const pickerBtn=document.createElement('button');pickerBtn.type='button';pickerBtn.className='pill-btn game-style-button';pickerBtn.id='gameStyleButton';pickerBtn.textContent='🎨';pickerBtn.setAttribute('aria-label','Choose chess piece style');pickerBtn.title='Choose chess piece style';
  pickerBtn.addEventListener('click',openPicker);toolbar.insertBefore(pickerBtn,toggle);
 }
 // Prevent the gameplay header from displaying the chooser on Home.
 const css=document.createElement('style');css.textContent='body:not(.arena-active) #gameStyleButton{display:none}body.arena-active #gameStyleButton{order:1;font-size:21px!important}body.arena-active #gameStyleButton::before{display:none}body.arena-active #characterViewToggle{order:2}';document.head.appendChild(css);
 // Keep avatar images consistent with the selected set on every render; raw game logic untouched.
 paintGame();
 window.TripleRookStyles={get:()=>applied,choose:chooseStyle,open:openPicker,all:STYLES.map(x=>x.id)};
})();

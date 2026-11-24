/* Triple Rook Chess reliable multiplayer (v1): Cloudflare Durable Object rooms.
 * Keeps Noah's existing move engine and all four piece styles intact.
 * The server authoritatively validates both secret moves and resolves rounds.
 */
(() => {
  'use strict';
  const backend=String(window.TRIPLE_ROOK_API_URL||'').trim().replace(/\/+$/,'');
  const roomPattern=/^[A-Za-z0-9_-]{16,64}$/;
  const qs=id=>document.getElementById(id);
  const apiReady=backend.startsWith('https://') || backend.startsWith('http://localhost:');
  const originalLock=lock;
  const originalHome=home;
  const originalRender=render;
  let session=null, snapshot=null, generation=0, pending=false, timer=null, failures=0;
  let internet='idle', lastError='';
  const existingMenu=document.querySelector('#menu');
  const status=document.createElement('div');status.className='room-connection';status.hidden=true;status.setAttribute('aria-live','polite');
  status.innerHTML='<span class="room-state-icon" aria-hidden="true">●</span><span class="room-state-text"></span><button type="button" class="room-share" hidden>Copy invite</button><button type="button" class="room-retry" hidden>Retry</button>';
  qs('board')?.parentElement?.parentElement?.insertAdjacentElement('afterend',status);
  const statusText=status.querySelector('.room-state-text');
  const retry=status.querySelector('.room-retry'),share=status.querySelector('.room-share');
  const inline=document.createElement('div');inline.className='room-menu-message';inline.hidden=true;inline.setAttribute('role','status');
  const inlineText=document.createElement('span');inline.appendChild(inlineText);
  const inlineRetry=document.createElement('button');inlineRetry.type='button';inlineRetry.textContent='Try again';inlineRetry.hidden=true;inline.appendChild(inlineRetry);
  existingMenu?.appendChild(inline);

  function saveSession(id,token){try{localStorage.setItem('trc-room:'+id,token)}catch(e){}}
  function readSession(id){try{return localStorage.getItem('trc-room:'+id)}catch(e){return null}}
  function saveInvite(id,url){try{sessionStorage.setItem('trc-invite:'+id,url)}catch(e){}}
  function readInvite(id){try{return sessionStorage.getItem('trc-invite:'+id)}catch(e){return null}}
  function displayError(message,allowRetry=true){inline.hidden=false;inlineText.textContent=message;inlineRetry.hidden=!allowRetry;}
  function clearError(){inline.hidden=true;inlineText.textContent='';lastError='';}
  function stripRoomUrl(){if(location.search.includes('room=')){history.replaceState(null,'',location.pathname);}}
  function stop(){generation++;clearTimeout(timer);timer=null;session=null;snapshot=null;pending=false;failures=0;internet='idle';status.hidden=true;retry.hidden=true;share.hidden=true;}
  function colorState(){status.dataset.state=internet;}
  function updateConnection(){
    if(!session || game.stage==='menu'){status.hidden=true;return;}
    status.hidden=false;
    const waitingForGuest=snapshot&&!snapshot.guestJoined;
    const myLock=snapshot?.myLocked;
    let message;
    if(internet==='reconnecting')message='Connection interrupted. Your game is saved. Reconnecting…';
    else if(internet==='connecting')message='Connecting to the game room…';
    else if(waitingForGuest)message='Waiting for Red to join. Share the invitation to start.';
    else if(snapshot?.outcome)message='Game finished. All rounds have been saved.';
    else if(myLock)message='Your move is securely locked. Waiting for opponent.';
    else if(snapshot?.opponentConnected===false)message='Opponent offline. You can still choose your move.';
    else message='Connected · '+(session.role==='host'?'Playing Blue':'Playing Red')+' · Round '+snapshot.round;
    if(lastError)message+=' '+lastError;
    statusText.textContent=message;colorState();
    retry.hidden=internet!=='reconnecting';
    share.hidden=!(session.role==='host'&&readInvite(session.id));
    const pt=qs('arenaPromptTitle');
    if(pt&&game.stage==='waiting') {
      if(waitingForGuest)pt.textContent='Waiting for Red to join';
      else if(internet==='reconnecting')pt.textContent='Restoring connection';
      else if(myLock)pt.textContent='Move locked securely';
      else pt.textContent='Waiting for opponent';
    }
    const subtitle=qs('phaseHelp');
    if(subtitle&&game.stage==='waiting')subtitle.textContent=message;
  }
  async function request(path,method='GET',body=null,token=null){
    if(!apiReady)throw new Error('Online multiplayer is not configured yet. The Cloudflare Worker must be deployed first.');
    let response;
    try {
      response=await fetch(backend+path,{method,mode:'cors',cache:'no-store',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
    }catch(e){throw new Error('Can’t reach the game service. Check your connection and try again.');}
    let data;try{data=await response.json()}catch{throw new Error('Unexpected response from the game service.');}
    if(!response.ok){const error=new Error(data?.error||'Game service rejected this request.');error.status=response.status;throw error;}
    return data;
  }
  function showInvite(){
    if(!session)return;
    const link=readInvite(session.id);if(!link)return;
    qs('handoffTitle').textContent='Invite your opponent';
    qs('handoffText').textContent='Send this link to the Red player. They can join from their own phone. The invitation is private.';
    qs('inviteLink').value=link;qs('handoffReady').textContent='Close';
    qs('copyInvite').textContent='Copy game link';show('handoff',true);
  }
  async function copyInvite(){
    const link=readInvite(session?.id);if(!link)return;
    try{await navigator.clipboard.writeText(link);share.textContent='Copied!';setTimeout(()=>{share.textContent='Copy invite'},1500);}catch{showInvite();}
  }
  function reportLatestRound(){
    if(!snapshot)return;
    const last=snapshot.history?.[snapshot.history.length-1];if(!last||last.round===0)return;
    const report=qs('roundReport');if(!report)return;
    report.replaceChildren();
    const heading=document.createElement('div');heading.className='heading';heading.textContent='Round '+last.round+' · Moves revealed';report.appendChild(heading);
    const results=document.createElement('div');results.className='result-rows';
    for(const [title,move] of [['🔵 Blue',last.whiteLabel],['🔴 Red',last.blackLabel]]){
      const row=document.createElement('div');row.className='result-row';
      for(const val of [title,move]){const el=document.createElement('span');el.textContent=val;row.appendChild(el)}results.appendChild(row);
    }
    report.appendChild(results);
    for(const value of last.events||[]){const d=document.createElement('div');d.className='event';d.textContent=value;report.appendChild(d)}
  }
  function applyState(data,force=false){
    if(!session||!data||data.roomId!==session.id)return;
    const changed=force||!snapshot||data.revision!==snapshot.revision||data.round!==snapshot.round;
    const wasAtLatest=game.viewIndex>=game.history.length-1;
    const previousRound=game.round;
    snapshot=data;internet='connected';lastError='';failures=0;
    if(changed){
      game.board=data.board;game.history=data.history;game.round=data.round;game.last=data.last;game.lastResult=data.lastResult;game.consecutivePass=data.consecutivePass;
      if(wasAtLatest||force)game.viewIndex=data.history.length-1;
      else game.viewIndex=Math.max(0,Math.min(game.viewIndex,data.history.length-1));
      if(previousRound!==data.round||force){game.selected=null;game.choices=[];game.pending=null;}
      const playable=data.guestJoined && !data.myLocked && !data.outcome;
      game.stage=data.outcome?'ended':playable?(session.role==='host'?'white':'black'):'waiting';
      game.online=true;game.role=session.role;
      if(session.role==='host')qs('modeBadge').textContent='🔗 ONLINE · BLUE';
      else qs('modeBadge').textContent='🔗 ONLINE · RED';
      reportLatestRound();render();
      if(data.outcome)showWinner();
    }
    updateConnection();
  }
  function schedule(gen,ms){clearTimeout(timer);timer=setTimeout(()=>{poll(gen)},ms);}
  async function poll(gen){
    if(gen!==generation||!session)return;
    try {
      const data=await request('/v1/rooms/'+session.id+'/state','GET',null,session.token);
      if(gen!==generation)return;
      applyState(data);
    }catch(e){
      if(gen!==generation)return;
      if(e.status===403||e.status===410||e.status===404){
        internet='reconnecting';lastError=e.message+' Return to the menu to start a new game.';updateConnection();return;
      }
      failures++;internet='reconnecting';lastError='';updateConnection();
    }
    if(gen===generation&&session)schedule(gen,failures?Math.min(15000,Math.pow(2,failures)*1600):document.hidden?9000:2500);
  }
  function activate(id,token,role,data){
    stop();const gen=generation;
    session={id,token,role};saveSession(id,token);
    // Reset only when joining a new room; subsequent polls never reset live play.
    startGame('online');game.online=true;game.role=role;game.stage='waiting';
    internet='connected';applyState(data,true);schedule(gen,2200);
  }
  async function createRoom(){
    if(pending)return;pending=true;internet='connecting';clearError();
    qs('friendButton').disabled=true;
    try {
      const result=await request('/v1/rooms','POST',{});
      const {roomId,hostToken,inviteToken,state}=result;
      if(!roomPattern.test(roomId))throw new Error('Invalid room ID.');
      const invitation=location.origin+location.pathname+'?room='+encodeURIComponent(roomId)+'#invite='+encodeURIComponent(inviteToken);
      saveInvite(roomId,invitation);
      history.replaceState(null,'',location.pathname+'?room='+encodeURIComponent(roomId));
      activate(roomId,hostToken,'host',state);showInvite();
    }catch(e){internet='idle';displayError(e.message);}finally{pending=false;qs('friendButton').disabled=false;}
  }
  async function resumeOrJoin(){
    const url=new URL(location.href),id=url.searchParams.get('room');
    if(!id)return;
    if(!roomPattern.test(id)){displayError('This game invitation has an invalid room ID.',false);return;}
    internet='connecting';clearError();
    let token=readSession(id);
    try {
      if(token){
        const state=await request('/v1/rooms/'+id+'/state','GET',null,token);
        activate(id,token,state.role,state);
      }else {
        const invite=new URLSearchParams(url.hash.slice(1)).get('invite');
        if(!invite){displayError('This game link does not include an invitation token. Ask for a new invitation.',false);return;}
        const result=await request('/v1/rooms/'+id+'/join','POST',{inviteToken:invite});
        token=result.guestToken;
        activate(id,token,'guest',result.state);
        history.replaceState(null,'',location.pathname+'?room='+encodeURIComponent(id));
      }
    }catch(e){displayError(e.message,e.status!==403&&e.status!==409&&e.status!==410);}
  }
  async function submitMove(){
    if(!game.online||!session)return originalLock();
    if(pending||!game.pending||!snapshot||snapshot.myLocked)return;
    if(!snapshot.guestJoined){lastError='Waiting for an opponent to join.';updateConnection();return;}
    pending=true;qs('lockButton').disabled=true;
    const move=game.pending,round=snapshot.round;
    try{
      const data=await request('/v1/rooms/'+session.id+'/moves','POST',{round,move},session.token);
      applyState(data,true);
    }catch(e){
      internet=e.status?'connected':'reconnecting';lastError=e.message;
      updateConnection();
      if(e.status===409)poll(generation);
    }finally{pending=false;render();}
  }
  function newOnlineMatch(){
    stop();stripRoomUrl();originalHome();createRoom();
  }
  function leave(){stop();stripRoomUrl();game.online=false;game.role=null;return originalHome()}
  home=leave;
  render=function(){const val=originalRender.apply(this,arguments);updateConnection();return val;};
  qs('friendButton').onclick=createRoom;
  qs('soloButton').onclick=()=>{stop();stripRoomUrl();game.online=false;game.role=null;startGame('solo');};
  qs('lockButton').onclick=submitMove;
  qs('winnerMenuButton').onclick=leave;
  qs('againButton').onclick=()=>game.online?newOnlineMatch():startGame(game.mode);
  share.onclick=copyInvite;retry.onclick=()=>{lastError='';poll(generation);};
  inlineRetry.onclick=()=>resumeOrJoin();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session)poll(generation);});
  window.TripleRookReliableMultiplayer={getStatus:()=>({roomId:session?.id,role:session?.role,connected:internet,round:snapshot?.round}),retry:()=>poll(generation)};
  if(new URL(location.href).searchParams.has('room'))resumeOrJoin();
})();

/* BLOSSOM × UbiTamer homepage chat (v18.1)
 * Uses existing blossom-public API; no server secrets in the browser.
 * Public guests see NO messages. BLOSSOM room is server-authorized.
 */
(()=>{
  'use strict';
  if(window.__BLOSSOM_HOME_CHAT_181__)return;
  window.__BLOSSOM_HOME_CHAT_181__=true;
  if(!['','index.html'].includes(location.pathname.split('/').pop().toLowerCase()))return;
  const API='https://hweouohzkwqhiwwsjlxu.supabase.co/functions/v1/blossom-public';
  const SESSION_KEY='blossom_test_auth_v1';
  const $=(s,root=document)=>root.querySelector(s);
  const n=(tag,klass,text)=>{const x=document.createElement(tag);if(klass)x.className=klass;if(text!==undefined)x.textContent=String(text);return x;};
  const state={user:null,rooms:[],room:'ubitetamer',rtUrl:'',rtKey:'',client:null,channel:null,rtReady:false,
    busy:false,fetching:null,lastSync:0,seq:0,interval:null,started:false};
  let root,feed,roomLabel,roomChoices,health,notice,form,input,submitButton,loginLink,hubLink;
  function setStatus(value,fail=false){if(!health)return;health.textContent=value;health.dataset.error=String(fail);}
  function clearFeed(message){feed.replaceChildren(n('p','bshc-empty',message));}
  function viewRoomTitle(room){return room==='blossom'?'🌸 BLOSSOM 길드 채팅':'🎮 우비테이머 전체 채팅';}
  async function getSession(){
    try{const s=await window.BlossomSession?.get?.();if(s?.access_token)return s;}catch{}
    try{const s=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');
      if(s?.access_token&&Number(s.expires_at)>Date.now()/1000+25)return s;
    }catch{}
    return null;
  }
  async function request(action,rest={}){
    const s=await getSession();if(!s?.access_token)throw Error('로그인이 만료됐어요. 다시 로그인해 주세요.');
    const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.access_token},
      cache:'no-store',body:JSON.stringify({action,...rest})});
    const data=await response.json().catch(()=>null);
    if(!response.ok||!data?.success)throw Error(data?.message||`서버 요청 실패 (${response.status})`);
    return data;
  }
  function makeUI(){
    const section=n('section','bsh-home-chat section');section.id='bshHomeChat';section.setAttribute('aria-label','메인 실시간 채팅');
    const heading=n('div','bshc-heading');
    const headingText=n('div','bshc-heading-main');
    headingText.append(n('span','bshc-eyebrow','DIGITAL WORLD · LIVE CHAT'),n('h2','', '💬 테이머 실시간 채팅'));
    const open=n('a','bshc-hub-link','전체 커뮤니티 ↗');open.href='public-hub.html';hubLink=open;
    heading.append(headingText,open);
    const layout=n('div','bshc-layout');
    const chat=n('div','bshc-chat');
    const top=n('div','bshc-top');
    roomLabel=n('strong','bshc-room',viewRoomTitle('ubitetamer'));
    const status=n('span','bshc-status','회원 확인 중');health=status;health.setAttribute('role','status');
    top.append(roomLabel,status);
    roomChoices=n('div','bshc-room-choices');roomChoices.hidden=true;
    feed=n('div','bshc-feed');feed.id='bshcFeed';feed.setAttribute('role','log');feed.setAttribute('aria-label','최근 채팅 메시지');
    clearFeed('로그인 상태를 확인하고 있어요.');
    notice=n('div','bshc-notice');notice.hidden=true;
    notice.append(n('p','','채팅을 이용하려면 회원가입 후 승인을 받고 로그인해 주세요.'));
    loginLink=n('a','bshc-login','로그인 · 회원가입 ↗');loginLink.href='auth.html?next=index.html#login';notice.append(loginLink);
    form=n('form','bshc-form');form.hidden=true;
    input=n('input','bshc-input');input.type='text';input.maxLength=500;input.required=true;input.autocomplete='off';input.placeholder='메시지를 입력하세요 (최대 500자)';input.setAttribute('aria-label','메시지 입력');
    submitButton=n('button','bshc-send','보내기');submitButton.type='submit';
    form.append(input,submitButton);
    const foot=n('p','bshc-foot','모든 메시지는 서버에 저장됩니다. 신고는 전체 커뮤니티의 채팅 메뉴에서 할 수 있어요.');
    chat.append(top,roomChoices,feed,notice,form,foot);
    const aside=n('aside','bshc-aside');
    aside.append(n('span','bshc-eyebrow','TAMER LOUNGE'),n('h3','','게임은 같이, 대화도 같이.'),
      n('p','','게임하면서 바로 이야기를 나눠보세요. 길드에 소속된 회원에게는 BLOSSOM 전용 채팅도 제공됩니다.'));
    const actions=n('div','bshc-aside-actions');
    const community=n('a','bshc-link','게시판 · 공략 · 신고하기 ↗');community.href='public-hub.html';
    const todo=n('a','bshc-link','오늘의 숙제 확인하기 ↗');todo.href='todo.html';
    actions.append(community,todo);aside.append(actions);
    layout.append(chat,aside);section.append(heading,layout);
    const quick=$('.quick');const hero=$('.hero');const target=quick||hero;
    if(target?.parentElement)target.insertAdjacentElement('afterend',section);
    else if($('main'))$('main').prepend(section);
    else document.body.append(section);
    root=section;form.addEventListener('submit',send);
  }
  function showGuest(message){
    state.user=null;state.rooms=[];state.room='ubitetamer';state.seq++;state.lastSync=0;state.fetching=null;
    roomLabel.textContent=viewRoomTitle('ubitetamer');roomChoices.hidden=true;roomChoices.replaceChildren();
    feed.hidden=true;notice.hidden=false;form.hidden=true;
    setStatus(message||'로그인 필요',!!message);
    stopRealtime();
  }
  function renderRooms(){
    roomChoices.replaceChildren();
    if(!state.rooms.includes('blossom')){roomChoices.hidden=true;return;}
    roomChoices.hidden=false;
    for(const [room,label] of [['ubitetamer','🎮 전체 테이머'],['blossom','🌸 BLOSSOM']]){
      if(!state.rooms.includes(room))continue;
      const button=n('button','bshc-room-btn',label);button.type='button';
      button.classList.toggle('active',room===state.room);button.setAttribute('aria-pressed',String(room===state.room));
      button.addEventListener('click',()=>{
        // Unified menu can be changed from this widget too.
        const navButton=$(`#bshRoomSelector button[data-room="${room}"]`);
        changeRoom(room);
        if(navButton)navButton.click();
      });
      roomChoices.append(button);
    }
  }
  function formatTime(value){
    const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
  }
  function renderMessages(messages,quiet){
    const pinned=feed.scrollHeight-feed.clientHeight-feed.scrollTop<85;
    const previous=feed.scrollTop;
    feed.replaceChildren();
    if(!messages.length)clearFeed('아직 채팅이 없어요. 첫 인사를 남겨주세요!');
    for(const m of messages.slice(-50)){
      const message=n('article','bshc-message');
      if(state.user&&m.author_id===state.user.id)message.classList.add('mine');
      const head=n('div','bshc-message-head');head.append(n('strong','',m.author_name||'테이머'),n('time','',formatTime(m.created_at)));
      message.append(head,n('p','',m.text||''));feed.append(message);
    }
    if(!quiet||pinned)feed.scrollTop=feed.scrollHeight;else feed.scrollTop=previous;
  }
  async function listMessages(quiet=false){
    if(!state.user)return;
    const room=state.room,seq=state.seq,fetchId=seq+':'+room;
    if(state.fetching===fetchId)return;
    state.fetching=fetchId;
    try{
      const data=await request('chat_list',{room});
      if(seq!==state.seq||room!==state.room)return;
      if(!Array.isArray(data.messages))throw Error('채팅 데이터 형식이 올바르지 않아요.');
      renderMessages(data.messages,quiet);state.lastSync=Date.now();
      if(!quiet)setStatus(state.rtReady?'실시간 연결됨':'자동 갱신 중');
    }catch(err){if(seq===state.seq){if(!quiet)clearFeed('채팅을 불러오지 못했어요.');setStatus(err.message||'채팅 연결 오류',true);}}
    finally{if(state.fetching===fetchId)state.fetching=null;}
  }
  async function send(e){
    e.preventDefault();if(state.busy||!state.user)return;
    const message=input.value.trim();if(!message||message.length>500)return;
    state.busy=true;submitButton.disabled=true;
    try{await request('chat_send',{room:state.room,text:message});input.value='';await listMessages(true);setStatus('메시지를 보냈어요.');}
    catch(err){setStatus(err.message||'전송 실패',true);}finally{state.busy=false;submitButton.disabled=false;}
  }
  async function stopRealtime(){
    const oldClient=state.client,oldChannel=state.channel;
    state.client=null;state.channel=null;state.rtReady=false;
    if(oldClient&&oldChannel){try{await oldClient.removeChannel(oldChannel);}catch{}}
  }
  async function startRealtime(){
    await stopRealtime();
    if(!state.user||!state.rtKey||!state.rtUrl){setStatus('자동 갱신 중');return;}
    const room=state.room,seq=state.seq;
    try{
      const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.91.0/+esm');
      if(seq!==state.seq)return;
      const session=await getSession();if(!session?.access_token)throw Error('로그인이 만료됨');
      const client=createClient(state.rtUrl,state.rtKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
      client.realtime.setAuth(session.access_token);
      const channel=client.channel('blossom-public:'+room,{config:{private:true}})
        .on('broadcast',{event:'changed'},()=>{if(state.room===room&&state.seq===seq)listMessages(true);})
        .subscribe(status=>{
          if(state.room!==room||state.seq!==seq)return;
          state.rtReady=status==='SUBSCRIBED';
          setStatus(state.rtReady?'● 실시간 연결됨':'자동 갱신 중');
        });
      if(seq!==state.seq){await client.removeChannel(channel);return;}
      state.client=client;state.channel=channel;
    }catch{if(seq===state.seq){state.rtReady=false;setStatus('자동 갱신 중');}}
  }
  async function changeRoom(next){
    // The client can select only server-provided authorized rooms. The API checks it again.
    if(!state.user||!state.rooms.includes(next)||state.room===next)return;
    state.room=next;state.seq++;state.lastSync=0;state.fetching=null;
    roomLabel.textContent=viewRoomTitle(next);renderRooms();clearFeed('채팅을 불러오는 중...');
    await stopRealtime();
    await listMessages();
    await startRealtime();
  }
  function watchNav(){
    const observer=new MutationObserver(()=>{
      if(!state.user)return;
      const requested=document.body.dataset.bshRoom;
      if(requested&&state.rooms.includes(requested)&&requested!==state.room)changeRoom(requested);
    });
    observer.observe(document.body,{attributes:true,attributeFilter:['data-bshRoom','data-bsh-room']});
    return observer;
  }
  async function bootstrap(){
    try{
      const data=await request('bootstrap');
      if(!data.user||!Array.isArray(data.rooms))throw Error('회원 정보를 확인할 수 없어요.');
      const rooms=data.rooms.filter(room=>room==='ubitetamer'||room==='blossom');
      if(!rooms.includes('ubitetamer'))throw Error('일반 채팅 권한을 확인할 수 없어요.');
      state.user=data.user;state.rooms=rooms;state.rtUrl=data.realtime_url||'';state.rtKey=data.realtime_public_key||'';
      const selected=document.body.dataset.bshRoom;
      // Prefer server-verified room, optionally use the unified nav's room selection.
      const pref=(()=>{try{return localStorage.getItem('blossom_selected_room_v18_'+data.user.id);}catch{return null;}})();
      state.room=rooms.includes(selected)&&selected==='blossom'?'blossom':
        rooms.includes(pref)?pref:rooms.includes(data.user.default_room)?data.user.default_room:'ubitetamer';
      roomLabel.textContent=viewRoomTitle(state.room);renderRooms();
      feed.hidden=false;notice.hidden=true;form.hidden=false;
      clearFeed('최근 채팅을 불러오는 중...');
      await listMessages();await startRealtime();
      if(!state.interval)state.interval=setInterval(async()=>{
        if(document.hidden||!state.user)return;
        const maxAge=state.rtReady?5*60*1000:60*1000;
        if(Date.now()-state.lastSync>=maxAge)await listMessages(true);
        if(state.client){const s=await getSession();if(s?.access_token)state.client.realtime.setAuth(s.access_token);else showGuest('로그인이 만료됐어요.');}
      },45000);
      watchNav();
    }catch(err){showGuest(err.message||'로그인이 필요해요.');}
  }
  function start(){
    if(state.started)return;state.started=true;makeUI();
    bootstrap();
    window.addEventListener('focus',()=>{if(state.user)listMessages(true);});
    window.addEventListener('blossom:logout',()=>showGuest('로그아웃했어요.'));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.user)listMessages(true);});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

/* BLOSSOM v17 public hub. Server is authoritative; all displayed user text uses textContent. */
(()=>{
  'use strict';
  const API='https://hweouohzkwqhiwwsjlxu.supabase.co/functions/v1/blossom-public';
  const SESSION_KEY='blossom_test_auth_v1';
  const ROOM_PREF_KEY='blossom_public_room_pref_v17';
  const $=id=>document.getElementById(id);
  const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=String(text);return x;};
  let state={user:null,room:'ubitetamer',tab:'chat',messages:[],posts:[],reports:[],currentPost:null,reportTarget:null,
    rangeStart:0,rangeEnd:0,busy:false,refreshBusy:false,rtClient:null,channel:null,rtReady:false,rtKey:'',rtUrl:'',refreshTimer:null,refreshSeq:0,lastSync:0};
  const fmtDate=v=>{try{return new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});}catch{return '';}};
  const btn=(text,onClick,cls='ghost-button')=>{const b=el('button',cls,text);b.type='button';b.onclick=onClick;return b;};
  function setStatus(text,bad=false){$('globalStatus').textContent=text||'';$('globalStatus').classList.toggle('error',!!bad);}
  function syncLabel(text){$('syncLabel').textContent=text;}
  async function session(){
    const latest=await window.BlossomSession?.get?.();
    if(latest?.access_token)return latest;
    try{const s=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');
      if(s?.access_token&&Number(s.expires_at)>Date.now()/1000+25)return s;}catch{}
    return null;
  }
  async function request(action,rest={}){
    const s=await session();if(!s?.access_token)throw Error('로그인 정보가 만료됐어요. 다시 로그인해 주세요.');
    let response;
    try{response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.access_token},
      cache:'no-store',body:JSON.stringify({action,...rest})});}
    catch{throw Error('서버 연결에 실패했습니다. 네트워크를 확인해 주세요.');}
    const d=await response.json().catch(()=>null);
    if(!response.ok||!d?.success){
      if(d?.code==='owner_mfa_required'||response.status===428)throw Error('최고관리자 OTP 확인이 필요해요. owner-security.html에서 인증한 뒤 다시 시도해 주세요.');
      throw Error(d?.message||`요청 실패 (${response.status})`);
    }
    return d;
  }
  function renderSession(d){
    state.user=d.user;state.rtKey=d.realtime_public_key||'';state.rtUrl=d.realtime_url||'';
    $('authNotice').hidden=true;$('mainPanel').hidden=false;
    $('nicknameTag').textContent='✦ '+d.user.nickname;
    $('tabs').querySelector('[data-tab="reports"]').hidden=!(d.user.can_manage_public||d.user.can_manage_guild);
    $('tabs').querySelector('[data-tab="applications"]').hidden=!(d.user.can_review_general||d.user.can_review_guild);
    $('tabs').querySelector('[data-tab="members"]').hidden=!(d.user.can_manage_global||d.user.can_manage_public);
    $('guildUpgrade').hidden=d.user.guild_verified||d.user.role==='site_owner';
    const joinKind=$('joinKind');
    [...joinKind.options].forEach(option=>{option.hidden= option.value==='general'?!d.user.can_review_general:!d.user.can_review_guild;});
    joinKind.value=d.user.can_review_general?'general':'guild';
    const sel=$('roomSelect');sel.replaceChildren();
    for(const r of d.rooms){const o=el('option','',r==='blossom'?'🌸 BLOSSOM · 길드 전용':'🎮 우비테이머 · 전체 테이머');o.value=r;sel.append(o);}
    let savedRoom='';try{savedRoom=localStorage.getItem('blossom_selected_room_v18_'+d.user.id)||'';}catch{}
    // Server-verified membership is the only source of room authorization.
    state.room=d.rooms.includes(savedRoom)?savedRoom:d.user.default_room;
    if(!d.rooms.includes(state.room))state.room='ubitetamer';
    sel.value=state.room;
    renderRoom();
  }
  function renderRoom(){
    document.documentElement.dataset.hubRoom=state.room;
    const g=state.room==='blossom';
    $('brandName').textContent=g?'BLOSSOM':'우비테이머';
    $('brandSub').textContent=g?'DIGITAL WORLD GUILD':'DIGITAL WORLD COMMUNITY';
    $('heroEyebrow').textContent=g?'BLOSSOM · GUILD LOUNGE':'UBI TAMER · COMMUNITY HUB';
    document.title=(g?'BLOSSOM':'우비테이머')+' | 디지털 월드 허브';
    $('heroTitle').replaceChildren(document.createTextNode(g?'BLOSSOM 길드의':'디지털 월드에서'),el('br'),el('span','',g?'우리만의 이야기.':'함께 이야기해요.'));
    $('heroDesc').textContent=g?'검증된 BLOSSOM 길드원과 사이트 운영자만 들어올 수 있는 전용 공간이에요.':'우비테이머를 보고 찾아온 테이머들과 함께 이야기를 나누는 공용 공간이에요.';
    $('roomInfo').textContent=g?'길드 내부 채팅과 전용 커뮤니티':'공용 채팅과 승인회원 커뮤니티';
    if(state.tab==='reports'&&!(g?state.user?.can_manage_guild:state.user?.can_manage_public))switchTab('chat');
    const reportsBtn=$('tabs').querySelector('[data-tab="reports"]');
    reportsBtn.hidden=!(g?state.user?.can_manage_guild:state.user?.can_manage_public);
  }
  function switchTab(tab){
    if(tab==='reports'&&$('tabs').querySelector('[data-tab="reports"]').hidden)return;
    if(tab==='members'&&!(state.user?.can_manage_global||state.user?.can_manage_public))return;
    if(tab==='applications'&&!(state.user?.can_review_general||state.user?.can_review_guild))return;
    state.tab=tab;
    document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));
    document.querySelectorAll('.tab-panel').forEach(x=>x.hidden=x.id!=='tab-'+tab);
    if(tab==='chat')loadChat();if(tab==='posts')loadPosts();if(tab==='reports')loadReports();if(tab==='applications')loadJoins();
  }
  async function loadChat(quiet=false){
    if(state.refreshBusy)return;
    state.refreshBusy=true;
    state.lastSync=Date.now();
    const room=state.room;
    try{
      const d=await request('chat_list',{room});
      if(room!==state.room)return;
      state.messages=d.messages;
      const feed=$('chatMessages');const atBottom=feed.scrollTop+feed.clientHeight>feed.scrollHeight-110;
      const oldTop=feed.scrollTop;
      feed.replaceChildren();
      if(!d.messages.length)feed.append(el('div','empty','아직 채팅이 없어요. 첫 인사를 남겨주세요!'));
      for(const m of d.messages){
        const item=el('div','chat-item'+(m.author_id===state.user.id?' mine':''));
        const main=el('div');const top=el('div');
        top.append(el('span','chat-author',m.author_name),el('span','chat-time',fmtDate(m.created_at)));
        main.append(top,el('div','chat-text',m.text));item.append(main);
        const actions=el('div','chat-actions');
        if(!m.hidden&&m.author_id&&m.author_id!==state.user.id){actions.append(btn('🚩 신고',()=>openReport(m),'tiny-button'));}
        item.append(actions);feed.append(item);
      }
      if(atBottom||!quiet)feed.scrollTop=feed.scrollHeight;else feed.scrollTop=oldTop;
      if(!quiet)setStatus('채팅이 갱신됐어요.');
    }catch(err){if(!quiet)setStatus(err.message,true);}finally{state.refreshBusy=false;}
  }
  async function sendChat(e){e.preventDefault();if(state.busy)return;
    const text=$('chatInput').value.trim();if(!text)return;
    state.busy=true;$('chatSubmit').disabled=true;
    try{await request('chat_send',{room:state.room,text});$('chatInput').value='';await loadChat(true);setStatus('메시지를 보냈어요.');}
    catch(err){setStatus(err.message,true);}finally{state.busy=false;$('chatSubmit').disabled=false;}
  }
  async function setupRealtime(){
    await clearRealtime();state.rtReady=false;syncLabel('실시간 연결 중');
    if(!state.rtKey||!state.rtUrl){syncLabel('자동 갱신 모드');return;}
    try{
      const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.91.0/+esm');
      const s=await session();if(!s?.access_token)throw Error('로그인이 만료됨');
      const client=createClient(state.rtUrl,state.rtKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
      client.realtime.setAuth(s.access_token);
      const room=state.room;
      const channel=client.channel('blossom-public:'+room,{config:{private:true}})
        .on('broadcast',{event:'changed'},()=>{if(state.room===room)loadChat(true);})
        .subscribe((status)=>{
          if(state.room!==room)return;
          state.rtReady=status==='SUBSCRIBED';
          syncLabel(state.rtReady?'실시간 연결됨':'자동 갱신 대기');
        });
      state.rtClient=client;state.channel=channel;
    }catch(err){state.rtReady=false;syncLabel('자동 갱신 모드');}
  }
  async function clearRealtime(){
    if(state.channel&&state.rtClient){try{await state.rtClient.removeChannel(state.channel);}catch{}}
    state.channel=null;state.rtClient=null;state.rtReady=false;
  }
  function startSyncTimer(){
    if(state.refreshTimer)clearInterval(state.refreshTimer);
    state.refreshTimer=setInterval(async()=>{
      if(document.hidden)return;
      // Real-time changes are push-notified. Poll only every 5 minutes while connected.
      // Fallback polling when disconnected is spaced to reduce server quotas.
      const maxAge=state.rtReady?5*60*1000:60*1000;
      if(state.tab==='chat'&&Date.now()-state.lastSync>=maxAge)await loadChat(true);
      if(state.rtClient){const s=await session();if(s?.access_token)state.rtClient.realtime.setAuth(s.access_token);}
    },45000);
  }
  function openReport(m){
    state.reportTarget=m;
    $('reportEvidence').value=m.text;
    state.rangeStart=0;state.rangeEnd=m.text.length;
    $('reportExplanation').value='';$('reportReason').value='abuse';$('reportStatus').textContent='';
    showReportPreview();$('reportDialog').showModal();
  }
  function showReportPreview(){
    const body=state.reportTarget?.text||'';
    const start=Math.min(state.rangeStart,body.length),end=Math.min(state.rangeEnd,body.length);
    const preview=$('selectedPreview');preview.replaceChildren();
    preview.append(document.createTextNode(body.slice(0,start)),el('mark','',body.slice(start,end)),document.createTextNode(body.slice(end)));
  }
  function useSelectedPart(){
    const area=$('reportEvidence');
    const a=area.selectionStart,b=area.selectionEnd;
    if(a===b){$('reportStatus').textContent='드래그해서 신고할 문장을 선택해 주세요.';return;}
    state.rangeStart=a;state.rangeEnd=b;showReportPreview();$('reportStatus').textContent='주황색으로 표시된 부분이 신고 증거에 포함됩니다.';
  }
  function useWholeMessage(){state.rangeStart=0;state.rangeEnd=state.reportTarget?.text?.length||0;showReportPreview();$('reportStatus').textContent='원본 메시지 전체를 신고합니다.';}
  async function sendReport(e){
    e.preventDefault();if(state.busy||!state.reportTarget)return;
    state.busy=true;$('reportSubmit').disabled=true;
    try{
      await request('report_chat',{message_id:state.reportTarget.id,selected_start:state.rangeStart,selected_end:state.rangeEnd,
        reason:$('reportReason').value,explanation:$('reportExplanation').value.trim()});
      $('reportDialog').close();setStatus('신고가 접수됐어요. 운영진이 원본 메시지와 선택한 구간을 확인할 수 있어요.');
    }catch(err){$('reportStatus').textContent=err.message;}finally{state.busy=false;$('reportSubmit').disabled=false;}
  }
  function renderPosts(){
    const q=$('postSearch').value.trim().toLowerCase();const root=$('postsList');root.replaceChildren();
    const rows=state.posts.filter(p=>!q||[p.title,p.body,p.author_name].join(' ').toLowerCase().includes(q));
    if(!rows.length){root.append(el('div','empty','게시글이 아직 없어요. 첫 번째 글을 등록해 보세요!'));return;}
    for(const p of rows){
      const card=el('article','post-card');card.tabIndex=0;card.setAttribute('role','button');
      const top=el('div');if(p.pinned)top.append(el('span','tag','📌 고정'));if(p.hidden)top.append(el('span','tag','숨김'));
      card.append(top,el('div','post-title',p.title),el('div','post-meta',p.author_name+' · '+fmtDate(p.created_at)),el('div','post-excerpt',p.body));
      card.onclick=()=>openPost(p);card.onkeydown=e=>{if(e.key==='Enter')openPost(p);};root.append(card);
    }
  }
  async function loadPosts(){
    const room=state.room;
    try{const d=await request('post_list',{room});if(room!==state.room)return;state.posts=d.posts;renderPosts();}
    catch(err){setStatus(err.message,true);}
  }
  async function createPost(e){
    e.preventDefault();if(state.busy)return;state.busy=true;$('writeSubmit').disabled=true;
    try{await request('post_create',{room:state.room,title:$('writeTitle').value.trim(),body:$('writeBody').value.trim()});
      $('writeDialog').close();$('writeForm').reset();setStatus('글이 등록됐어요.');await loadPosts();}
    catch(err){$('writeStatus').textContent=err.message;}finally{state.busy=false;$('writeSubmit').disabled=false;}
  }
  async function openPost(p){
    state.currentPost=p;$('detailTitle').textContent=p.title;
    $('detailMeta').textContent=p.author_name+' · '+fmtDate(p.created_at);
    $('detailBody').textContent=p.body;
    $('commentInput').value='';$('commentStatus').textContent='';
    const actions=$('detailActions');actions.replaceChildren();
    if(p.is_mine||state.user.can_manage_global||state.room==='blossom'&&state.user.can_manage_guild)
      actions.append(btn('게시글 숨김',async()=>{if(!confirm('이 글을 숨김 처리할까요?'))return;
        try{await request('post_hide',{post_id:p.id});$('postDialog').close();await loadPosts();setStatus('게시글을 숨겼어요.');}
        catch(err){setStatus(err.message,true);}}));
    $('postDialog').showModal();await loadComments();
  }
  async function loadComments(){
    if(!state.currentPost)return;const root=$('detailComments');root.replaceChildren(el('div','empty','댓글 불러오는 중...'));
    try{const d=await request('post_comments',{post_id:state.currentPost.id});root.replaceChildren();
      if(!d.comments.length)root.append(el('div','empty','아직 댓글이 없어요.'));
      for(const c of d.comments){const card=el('div','comment-card');card.append(el('div','comment-meta',c.author_name+' · '+fmtDate(c.created_at)),el('div','comment-body',c.text));root.append(card);}
    }catch(err){root.replaceChildren(el('div','empty',err.message));}
  }
  async function sendComment(e){e.preventDefault();if(!state.currentPost||state.busy)return;
    state.busy=true;try{await request('comment_create',{post_id:state.currentPost.id,text:$('commentInput').value.trim()});
      $('commentInput').value='';await loadComments();$('commentStatus').textContent='댓글을 등록했어요.';}
    catch(err){$('commentStatus').textContent=err.message;}finally{state.busy=false;}
  }
  function renderEvidence(container,r){
    const body=r.evidence_body||'';let a=Number(r.selected_start),b=Number(r.selected_end);
    a=Math.max(0,Math.min(a,body.length));b=Math.max(a,Math.min(b,body.length));
    container.replaceChildren(document.createTextNode(body.slice(0,a)),el('mark','',body.slice(a,b)),document.createTextNode(body.slice(b)));
  }
  async function loadReports(){
    const room=state.room;
    try{const d=await request('report_list',{room});if(room!==state.room)return;state.reports=d.reports;const root=$('reportsList');root.replaceChildren();
      if(!d.reports.length){root.append(el('div','empty','신고가 없습니다.'));return;}
      for(const r of d.reports){const card=el('article','report-card');
        card.append(el('div','post-title','🚨 '+r.evidence_author_name+' · '+(r.status==='pending'?'접수 대기':r.status==='reviewed'?'처리 완료':'반려')),
          el('div','report-meta','신고자 '+r.reporter_name+' · '+fmtDate(r.created_at)+' · '+r.reason));
        const evidence=el('div','report-evidence-show');renderEvidence(evidence,r);card.append(evidence);
        if(r.explanation)card.append(el('div','post-excerpt','신고 사유: '+r.explanation));
        if(r.status==='pending'){
          const actions=el('div','inline-right');
          actions.append(btn('무혐의 / 반려',()=>handleReport(r,'dismissed',false,0)),
            btn('검토 완료',()=>handleReport(r,'reviewed',false,0)),
            btn('메시지 숨김',()=>handleReport(r,'reviewed',true,0)),
            btn('숨김 + 24시간 작성 제한',()=>handleReport(r,'reviewed',true,24)));
          card.append(actions);
        }
        root.append(card);
      }
    }catch(err){setStatus(err.message,true);}
  }
  async function handleReport(r,status,hide,mute){
    if(!confirm(`신고를 ${status==='dismissed'?'반려':'처리'}할까요? ${hide?'메시지 숨김 ':''}${mute?'· 24시간 채팅 제한':''}`))return;
    try{const d=await request('report_review',{report_id:r.id,status,hide_message:hide,mute_hours:mute});
      setStatus(d.message);await loadReports();}
    catch(err){setStatus(err.message,true);}
  }
  async function findMember(e){e.preventDefault();const name=$('memberUsername').value.trim();
    const root=$('memberResult');root.replaceChildren(el('p','empty','조회 중...'));
    try{const d=await request('owner_member_find',{username:name});const m=d.member;root.replaceChildren();
      root.append(el('div','post-title',m.digimon_nickname||m.username),el('div','meta',`아이디 ${m.username} · 계정 ${m.status} · ${m.guild_verified?'BLOSSOM 소속 인증됨':'일반 테이머'} · ${m.public_staff?'공용 운영진':''}`));
      const row=el('div','inline-right');
      if(state.user.can_manage_global){
        row.append(btn(m.guild_verified?'🌸 길드 소속 해제':'🌸 BLOSSOM 소속 인증',async()=>{
          if(!confirm('실제 길드 소속을 확인했나요?'))return;
          try{await request('owner_member_verify',{profile_id:m.id,verified:!m.guild_verified});setStatus('길드 소속 설정 완료');await findMember({preventDefault(){}});}
          catch(err){setStatus(err.message,true);}
        },'ghost-button'));
        row.append(btn(m.public_staff?'🎮 일반 운영진 해제':'🎮 일반 운영진 지정',async()=>{
          if(!confirm('해당 회원에게 일반 테이머 관리 권한을 부여하거나 해제할까요?'))return;
          try{await request('general_staff_change',{profile_id:m.id,enabled:!m.public_staff});setStatus('운영진 권한 변경 완료');await findMember({preventDefault(){}});}
          catch(err){setStatus(err.message,true);}
        },'ghost-button'));
      }
      if(!m.guild_verified&&!m.public_staff&&m.role==='member'&&(m.status==='approved'||m.status==='rejected')){
        row.append(btn(m.status==='approved'?'⛔ 일반 회원 이용 중지':'✅ 일반 회원 이용 재개',async()=>{
          const mode=m.status==='approved'?'suspend':'restore';
          if(!confirm(mode==='suspend'?'일반 회원 이용을 중지할까요?':'이용 중지를 해제할까요?'))return;
          try{await request('general_account_access',{profile_id:m.id,mode});setStatus('회원 이용 상태 변경 완료');await findMember({preventDefault(){}});}
          catch(err){setStatus(err.message,true);}
        },'ghost-button'));
      }
      root.append(row);
    }catch(err){root.replaceChildren(el('p','empty',err.message));}
  }
  async function changeRoom(){
    const requested=$('roomSelect').value;
    if(requested==='blossom'&&!state.user?.can_view_guild)return;
    state.room=requested;
    try{localStorage.setItem(ROOM_PREF_KEY,state.room);if(state.user?.id)localStorage.setItem('blossom_selected_room_v18_'+state.user.id,state.room);}catch{}
    renderRoom();
    if(state.tab==='chat')await loadChat();if(state.tab==='posts')await loadPosts();if(state.tab==='reports')await loadReports();if(state.tab==='applications')await loadJoins();
    await setupRealtime();
  }

  async function loadJoins(){
    const kind=$('joinKind').value;const root=$('joinsList');root.replaceChildren(el('div','empty','가입 신청 조회 중...'));
    try{
      const d=await request('joins_list',{kind});root.replaceChildren();
      if(!d.requests.length){root.append(el('div','empty','대기 중인 가입 신청이 없어요.'));return;}
      for(const a of d.requests){const item=el('article','post-card');
        item.append(el('div','post-title',(kind==='guild'?'🌸 ':'🎮 ')+(a.nickname||a.username)),
          el('div','post-meta','아이디 '+a.username+' · 신청 '+fmtDate(a.requested_at)+' · '+a.profile_status));
        const actions=el('div','inline-right');
        actions.append(btn('승인',()=>reviewJoin(a,'approve'),'action-button'),btn('거절',()=>reviewJoin(a,'reject'),'ghost-button'));
        item.append(actions);root.append(item);
      }
    }catch(e){root.replaceChildren(el('p','empty',e.message));}
  }
  async function reviewJoin(a,decision){
    if(!confirm(`${a.username}님의 ${$('joinKind').value==='guild'?'길드':'일반'} 가입을 ${decision==='approve'?'승인':'거절'}할까요?`))return;
    try{await request('join_review',{profile_id:a.profile_id,decision});setStatus('가입 신청을 처리했어요.');await loadJoins();}
    catch(e){setStatus(e.message,true);}
  }
  async function upgradeGuild(){
    if(!confirm('실제 BLOSSOM 길드원만 신청해 주세요. 길드마스터가 확인합니다.'))return;
    try{await request('guild_upgrade_request');setStatus('길드 소속 신청을 접수했어요.');$('guildUpgradeButton').disabled=true;}
    catch(e){setStatus(e.message,true);}
  }

  function wire(){
    $('roomSelect').addEventListener('change',changeRoom);
    document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
    $('chatRefresh').onclick=()=>loadChat();$('chatForm').onsubmit=sendChat;
    $('newPost').onclick=()=>{$('writeStatus').textContent='';$('writeDialog').showModal();};$('writeForm').onsubmit=createPost;
    $('postSearch').oninput=renderPosts;$('postRefresh').onclick=loadPosts;$('commentForm').onsubmit=sendComment;
    $('reportsRefresh').onclick=loadReports;$('memberFindForm').onsubmit=findMember;
    $('joinRefresh').onclick=loadJoins;$('joinKind').onchange=loadJoins;$('guildUpgradeButton').onclick=upgradeGuild;
    $('reportForm').onsubmit=sendReport;$('selectReportPart').onclick=useSelectedPart;$('selectReportWhole').onclick=useWholeMessage;
    document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
    window.addEventListener('focus',()=>{if(state.user&&state.tab==='chat')loadChat(true);});
    window.addEventListener('blossom:logout',()=>{clearRealtime();location.href='auth.html#login';});
  }
  async function start(){
    wire();try{
      const d=await request('bootstrap');renderSession(d);
      await loadChat();startSyncTimer();await setupRealtime();
    }catch(err){$('authNotice').hidden=false;$('mainPanel').hidden=true;$('authMessage').textContent=err.message;syncLabel('로그인 필요');}
  }
  start();
})();

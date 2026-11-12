/* BLOSSOM v18.3: guild roster + membership management; never account bans. */
(()=>{
  'use strict';
  const API='https://hweouohzkwqhiwwsjlxu.supabase.co/functions/v1/blossom-membership';
  const SESSION_KEY='blossom_test_auth_v1';
  const $=id=>document.getElementById(id);
  const state={user:null,roster:[],directory:[],scope:'general',busy:false};
  const el=(tag,cls,value)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(value!==undefined)x.textContent=String(value);return x;};
  function status(message,error=false){$('gmStatus').textContent=message;$('gmStatus').classList.toggle('error',!!error);}
  function fail(message){$('gmDenied').hidden=false;$('gmDeniedText').textContent=message;status('접근 권한을 확인하지 못했습니다.',true);}
  function roleName(role){return ({site_owner:'사이트 최고관리자',guild_master:'길드마스터',vice_master:'부길드마스터',staff:'운영진',member:'일반 회원'})[role]||'회원';}
  function limitPromise(p,ms){return Promise.race([Promise.resolve(p).catch(()=>null),new Promise(r=>setTimeout(()=>r(null),ms))]);}
  async function token(){
    let s=null;
    try {s=await limitPromise(window.BlossomSession?.get?.(),4500);}catch{}
    if(s?.access_token)return s.access_token;
    try {s=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');
      if(s?.access_token&&Number(s.expires_at)>Date.now()/1000+20)return s.access_token;
    }catch{}
    return null;
  }
  async function request(action,params={}){
    const access=await token();if(!access)throw Error('로그인이 만료되었거나 세션을 확인하지 못했습니다. 계정 화면에서 다시 로그인해 주세요.');
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),14000);
    let res;
    try{res=await fetch(API,{method:'POST',cache:'no-store',signal:controller.signal,
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+access},body:JSON.stringify({action,...params})});}
    catch(e){throw Error(e?.name==='AbortError'?'서버 응답이 지연되고 있습니다. 페이지를 새로고침하거나 배포 상태를 확인해 주세요.':'서버에 연결할 수 없습니다.');}
    finally{clearTimeout(timeout);}
    const body=await res.json().catch(()=>null);
    if(!res.ok||!body?.success){
      if(res.status===428||body?.code==='owner_mfa_required')
        throw Error('사이트 최고관리자 OTP 인증이 필요합니다. owner-security.html에서 인증한 뒤 다시 시도하세요.');
      throw Error(body?.message||`API 오류 (${res.status}). blossom-membership 배포 여부를 확인해 주세요.`);
    }
    return body;
  }
  function renderRoster(){
    const root=$('gmRosterItems');root.replaceChildren();
    const q=$('gmRosterSearch').value.trim().toLocaleLowerCase('ko-KR');
    const rows=state.roster.filter(m=>(m.nickname||'').toLocaleLowerCase('ko-KR').includes(q));
    $('gmRosterCount').textContent=`인증된 길드원 ${state.roster.length}명`;
    if(!rows.length){root.append(el('div','gm-empty',q?'검색된 길드원이 없습니다.':'등록된 길드원이 없습니다.'));return;}
    for(const m of rows){
      const item=el('article','gm-member'),info=el('div');
      info.append(el('strong','',m.nickname||'테이머'),el('small','',roleName(m.role)));
      item.append(el('div','gm-avatar','✿'),info);root.append(item);
    }
  }
  async function refreshRoster(){
    const data=await request('guild_roster');state.roster=data.members||[];
    $('gmRosterPanel').hidden=false;
    $('gmRosterNote').textContent=data.truncated?'조회 한도(1,000명)에 도달했습니다. 전체 확인은 관리자에게 문의하세요.':'';
    renderRoster();status('길드원 명단을 불러왔습니다.');
  }
  function stat(title,value){const root=el('div','gm-stat');root.append(el('strong','',value),el('small','',title));return root;}
  function badge(title,cls=''){return el('span','gm-badge'+(cls?' '+cls:''),title);}
  function buildAction(m){
    const b=el('button','gm-button'+(m.guild_verified?' gm-danger':''),m.guild_verified?'길드원 명단에서 제외':'길드원 등록');
    b.type='button';b.disabled=state.busy||m.can_change!==true;
    b.title=m.can_change!==true?'이 회원은 현재 관리 계정으로 길드 소속을 변경할 수 없습니다.':'';
    b.addEventListener('click',()=>updateMembership(m));return b;
  }
  function buildRow(m){
    const tr=document.createElement('tr'),name=el('td');
    name.append(el('strong','',m.nickname||m.username),el('small','',m.username||''));tr.append(name);
    tr.append(el('td','',roleName(m.role)));
    const membership=el('td');membership.append(badge(m.guild_verified?'BLOSSOM 길드원':'일반 테이머',m.guild_verified?'guild':''));tr.append(membership);
    const actions=el('td');actions.append(buildAction(m));tr.append(actions);return tr;
  }
  function renderDirectory(){
    if(!state.user?.can_manage_membership)return;
    const root=$('gmOwnerRows');root.replaceChildren();
    const q=$('gmAdminSearch').value.trim().toLocaleLowerCase('ko-KR');
    const rows=state.directory.filter(m=>(state.scope==='guild'?m.guild_verified:!m.guild_verified) &&
      (!q||`${m.nickname||''} ${m.username||''}`.toLocaleLowerCase('ko-KR').includes(q)));
    if(!rows.length){const tr=document.createElement('tr');const td=el('td','gm-empty',q?'검색 결과가 없습니다.':'표시할 회원이 없습니다.');td.colSpan=4;tr.append(td);root.append(tr);return;}
    rows.forEach(m=>root.append(buildRow(m)));
  }
  async function refreshDirectory(){
    const data=await request('guild_directory');state.directory=data.members||[];
    $('gmOwnerPanel').hidden=false;
    $('gmOwnerNote').textContent=data.truncated?'※ 목록은 최대 1,000명까지 표시됩니다. 목록에 없는 회원은 정확한 아이디로 조회하세요.':'';
    $('gmSummary').replaceChildren(stat('일반 테이머',state.directory.filter(m=>!m.guild_verified).length),
      stat('인증된 길드원',state.directory.filter(m=>m.guild_verified).length));
    renderDirectory();
  }
  async function updateMembership(m){
    if(state.busy||m.can_change!==true)return;
    const next=!m.guild_verified,name=m.nickname||m.username;
    const question=next?
      `${name} 님이 실제 BLOSSOM 길드원인가요? 등록하면 BLOSSOM 내부 공간에 접근할 수 있습니다.`:
      `${name} 님을 BLOSSOM 길드원 명단에서 제외할까요? 우비테이머 사이트 회원 자격, 일반 채팅 및 계정은 그대로 유지됩니다.`;
    if(!window.confirm(question))return;
    state.busy=true;renderDirectory();
    try{
      await request('guild_update_membership',{profile_id:m.id,verified:next});
      await Promise.all([refreshDirectory(),refreshRoster()]);
      status(next?`${name} 님을 BLOSSOM 길드원으로 등록했습니다.`:
        `${name} 님을 길드원 명단에서 제외했습니다. 우비테이머 계정은 유지됩니다.`);
      if($('gmLookupResult').querySelector('[data-profile-id]')?.dataset.profileId===m.id)await findUser(m.username);
    }catch(e){status(e.message,true);}
    finally{state.busy=false;renderDirectory();}
  }
  function renderFound(m){
    const root=$('gmLookupResult');root.replaceChildren();
    const row=el('div','gm-member');row.dataset.profileId=m.id;
    const info=el('div');info.style.flex='1';
    info.append(el('strong','',m.nickname||m.username),el('small','',
      `아이디 ${m.username} · ${roleName(m.role)} · ${m.guild_verified?'길드원':'일반 테이머'}`));
    row.append(el('div','gm-avatar','✿'),info,buildAction(m));root.append(row);
  }
  async function findUser(name){
    try{const d=await request('guild_find',{username:name});renderFound(d.member);}
    catch(e){$('gmLookupResult').replaceChildren(el('p','gm-small',e.message));status(e.message,true);}
  }
  function events(){
    $('gmRefresh').onclick=()=>refreshRoster().catch(e=>status(e.message,true));
    $('gmRosterSearch').oninput=renderRoster;$('gmAdminSearch').oninput=renderDirectory;
    document.querySelectorAll('[data-scope]').forEach(b=>b.onclick=()=>{
      state.scope=b.dataset.scope;
      document.querySelectorAll('[data-scope]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});
      renderDirectory();
    });
    $('gmLookupForm').onsubmit=e=>{e.preventDefault();findUser($('gmLookupName').value.trim());};
  }
  async function start(){
    $('gmShell').dataset.scriptLoaded='yes';events();
    try{
      const d=await request('access');state.user=d.user;
      if(!d.user?.can_view_guild){fail('BLOSSOM 길드 인증이 필요합니다. 일반 회원은 우비테이머 사이트를 계속 이용할 수 있습니다.');return;}
      try{await refreshRoster();}catch(e){status('길드원 명단 조회 오류: '+e.message,true);}
      if(d.user.can_manage_membership){
        $('gmOwnerPanel').hidden=false;
        $('gmManagerKind').textContent=d.user.role==='site_owner'?'사이트 최고관리자 · OTP 필요':'BLOSSOM 길드관리자';
        try{await refreshDirectory();}
        catch(e){
          status(e.message,true);
          $('gmOwnerNote').replaceChildren();
          if(d.user.role==='site_owner'&&d.user.mfa_required){
            const link=el('a','gm-button','최고관리자 OTP 인증하기');link.href='owner-security.html';
            $('gmOwnerNote').append(document.createTextNode(e.message+' '),link);
          } else $('gmOwnerNote').textContent=e.message;
        }
      }
    }catch(e){fail(e.message);}
    finally{$('gmShell').dataset.ready='yes';}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

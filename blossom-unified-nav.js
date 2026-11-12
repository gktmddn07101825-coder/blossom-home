/* BLOSSOM × UbiTamer unified navigation v18
 * UI only. All membership and access rules must be enforced on Supabase.
 * No secret/service_role key is used here.
 */
(() => {
  'use strict';
  if (window.__BLOSSOM_UNIFIED_NAV_V18__) return;
  window.__BLOSSOM_UNIFIED_NAV_V18__ = true;

  const API = 'https://hweouohzkwqhiwwsjlxu.supabase.co/functions/v1/blossom-public';
  const SESSION_KEY = 'blossom_test_auth_v1';
  const LEGACY_ROOM_KEY = 'blossom_public_room_pref_v17';
  const PERSONAL_PREFIX = 'blossom_selected_room_v18_';
  const GUILD_PATHS = new Set(['event.html', 'tips.html', 'help.html']);
  const pages = [
    {title:'🏠 홈',href:'index.html',kind:'shared'},
    {title:'💬 채팅 · 커뮤니티',href:'public-hub.html',kind:'shared'},
    {title:'☑ 숙제 체크리스트',href:'todo.html',kind:'shared'},
    {title:'⏱ 버프 타이머',href:'timer.html',kind:'shared'},
    {title:'💰 목표 수익 캘린더',href:'wealth.html',kind:'shared'},
    {title:'🎁 출석 · BP 상점',href:'shop.html',kind:'shared'},
    {title:'⌛ 미니 타이머',href:'mini.html',kind:'shared'},
    {title:'🗓 BLOSSOM 공지 · 일정',href:'event.html',kind:'guild'},
    {title:'📚 길드 꿀팁 저장소',href:'tips.html',kind:'guild'},
    {title:'🤝 뉴비 도움 인증',href:'help.html',kind:'guild'}
  ];
  const state = { room:'ubitetamer', rooms:['ubitetamer'], user:null, loaded:false };
  const $ = (s,root=document) => root.querySelector(s);
  const node = (tag,cls,text) => {const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const pageName = () => location.pathname.split('/').pop().toLowerCase() || 'index.html';
  const brandName = () => state.room==='blossom'?'BLOSSOM':'우비테이머';
  const userPrefKey = () => state.user?.id ? PERSONAL_PREFIX + state.user.id : null;
  function getSaved(k){try{return localStorage.getItem(k);}catch{return null;}}
  function putSaved(k,v){try{localStorage.setItem(k,v);}catch{}}
  function currentSession(){
    try {const d=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');
      return d && d.access_token && d.expires_at > Date.now()/1000+25 ? d : null;
    } catch {return null;}
  }
  async function getSession(){
    try{const s=await window.BlossomSession?.get?.();if(s?.access_token)return s;}catch{}
    return currentSession();
  }
  function isAuthorized(room){return room==='ubitetamer'||state.rooms.includes('blossom');}
  function updateHome(){
    if(!document.body.classList.contains('bsh-home'))return;
    if(!document.body.dataset.bshOriginalTitle)document.body.dataset.bshOriginalTitle=document.title;
    document.title=state.room==='blossom'?document.body.dataset.bshOriginalTitle:'우비테이머 | DIGITAL WORLD COMMUNITY';
    const guide=$('#guide');
    if(guide){const h=guide.querySelector('h2'),p=guide.querySelector('p');
      if(h&&!h.dataset.guildText)h.dataset.guildText=h.textContent;
      if(p&&!p.dataset.guildText)p.dataset.guildText=p.textContent;
      if(h)h.textContent=state.room==='blossom'?h.dataset.guildText:'📖 우비테이머 이용 가이드';
      if(p)p.textContent=state.room==='blossom'?p.dataset.guildText:'로그인 후 숙제 체크리스트, 버프 타이머, 목표 수익 캘린더, 실시간 채팅과 커뮤니티를 사용할 수 있어요. 개인 설정은 계정별로 저장됩니다.';
    }
    const footer=$('.footer .wrap');
    if(footer){if(!footer.dataset.guildText)footer.dataset.guildText=footer.textContent;
      footer.textContent=state.room==='blossom'?footer.dataset.guildText:'우비테이머 · DIGITAL WORLD COMMUNITY';}
    const hero=$('.hero');
    if(hero && !$('.bsh-public-hero',hero)){
      const content=node('div','bsh-public-hero');
      content.innerHTML='<span class="bsh-eyebrow">UBI TAMER · DIGITAL WORLD</span><h1>테이머들의<br><em>새로운 아지트.</em></h1><p>우비테이머와 함께하는 디지몬 마스터즈 커뮤니티.<br>소통하고, 게임 편의 기능을 한곳에서 사용하세요.</p>';
      const actions=node('div','bsh-hero-actions');
      const a=node('a','bsh-primary','💬 실시간 채팅 · 커뮤니티');a.href='public-hub.html';
      const b=node('a','bsh-secondary','☑ 숙제 체크리스트');b.href='todo.html';
      actions.append(a,b);content.append(actions);hero.append(content);
    }
    const quick=$('.quick');
    if(quick && !$('#bsh-new-quick',quick)){
      const card=node('a','tile bsh-hub-tile');card.id='bsh-new-quick';card.href='public-hub.html';
      card.innerHTML='<span class="ico">💬</span><strong>실시간 채팅 · 커뮤니티 ↗</strong><p>일반 테이머와 길드원이 모이는 공간</p>';
      quick.prepend(card);
      if(!quick.querySelector('a[href="wealth.html"]')){
        const wealth=node('a','tile bsh-wealth-tile');wealth.href='wealth.html';
        wealth.innerHTML='<span class="ico">💰</span><strong>목표 수익 캘린더 ↗</strong><p>사냥 수익과 목표 달성일 기록</p>';
        quick.append(wealth);
      }
    }
  }
  function updatePublicHub(){
    const selector=$('#roomSelect');
    if(!selector || !state.user)return;
    if([...selector.options].some(o=>o.value===state.room) && selector.value!==state.room){
      selector.value=state.room;
      selector.dispatchEvent(new Event('change',{bubbles:true}));
    }
  }
  function applyRoom(room,remember=true){
    if(!isAuthorized(room))return;
    state.room=room;
    document.body.dataset.bshRoom=room;
    document.documentElement.dataset.bshTheme=room;
    const name=$('#bshBrandName');if(name)name.textContent=brandName();
    const sub=$('#bshBrandSub');if(sub)sub.textContent=room==='blossom'?'길드 전용 공간':'모든 테이머의 공간';
    const select=$('#bshRoomSelector');
    if(select){select.hidden=!state.rooms.includes('blossom');
      select.querySelectorAll('button').forEach(b=>{
        const active=b.dataset.room===room;
        b.classList.toggle('active',active);
        b.setAttribute('aria-pressed',String(active));
      });}
    if(remember&&state.user){const key=userPrefKey();if(key)putSaved(key,room);putSaved(LEGACY_ROOM_KEY,room);}
    renderMenus();updateHome();updatePublicHub();
  }
  function makeLink(p){const a=node('a','bsh-menu-link',p.title);a.href=p.href;
    if(pageName()===p.href)a.setAttribute('aria-current','page');return a;}
  function renderMenus(){
    const more=$('#bshMoreLinks');const user=$('#bshUserLinks');
    if(more){more.replaceChildren();
      pages.filter(p=>p.kind==='shared'||state.rooms.includes('blossom')).forEach(p=>more.append(makeLink(p)));
      if(!state.rooms.includes('blossom')){
        const note=node('div','bsh-menu-note','🌸 BLOSSOM 내부 메뉴는 실제 길드원에게만 표시됩니다.');more.append(note);
      }
    }
    const quick=$('#bshQuickLinks');if(quick){quick.replaceChildren();
      pages.filter(p=>['index.html','public-hub.html','todo.html','timer.html'].includes(p.href))
        .forEach(p=>quick.append(makeLink(p)));
    }
    if(user){user.replaceChildren();
      const account=node('a','bsh-menu-link','👤 계정 · 로그인');account.href='auth.html';user.append(account);
      if(state.user){
        const u=state.user;
        if(u.can_manage_global||u.can_review_general||u.can_review_guild){
          const mod=node('a','bsh-menu-link','🛡 승인 · 신고 관리');mod.href='public-hub.html';user.append(mod);
        }
        if(u.role==='site_owner'||u.can_review_guild){const admin=node('a','bsh-menu-link','⚙ 관리자 센터');admin.href='admin.html';user.append(admin);}
        if(u.role==='site_owner'){const mfa=node('a','bsh-menu-link','🔐 최고관리자 OTP');mfa.href='owner-security.html';user.append(mfa);}
        const logout=node('button','bsh-menu-link bsh-danger','↪ 로그아웃');logout.type='button';logout.onclick=()=>{
          try{window.BlossomSession?.logout?.();sessionStorage.removeItem(SESSION_KEY);}catch{}
          location.href='auth.html#login';
        };user.append(logout);
      }
    }
    const badge=$('#bshUserBadge');
    if(badge){if(state.user){
      const u=state.user;
      const role=u.role==='site_owner'?'최고관리자':u.can_review_general&&!u.guild_verified?'일반 운영진':u.role==='guild_master'&&u.guild_verified?'길드마스터':u.guild_verified?'BLOSSOM 길드원':'일반 테이머';
      badge.textContent='👤 '+u.nickname+' · '+role;
    }else badge.textContent=state.loaded?'로그인 / 회원가입':'회원 확인 중';}
  }
  function makeShell(){
    const header=node('header','bsh-header');header.id='bshHeader';
    const inner=node('div','bsh-inner');
    const brand=node('a','bsh-brand');brand.href='index.html';
    brand.innerHTML='<span class="bsh-brand-icon">✿</span><span><strong id="bshBrandName">우비테이머</strong><small id="bshBrandSub">모든 테이머의 공간</small></span>';
    const nav=node('nav','bsh-primary-nav');nav.setAttribute('aria-label','주요 메뉴');
    for(const [title,href] of [['홈','index.html'],['채팅 · 커뮤니티','public-hub.html'],['숙제','todo.html'],['버프 타이머','timer.html']]){
      const a=node('a','',title);a.href=href;if(pageName()===href)a.classList.add('current');nav.append(a);
    }
    const room=node('div','bsh-room-select');room.id='bshRoomSelector';room.hidden=true;room.setAttribute('aria-label','현재 공간 전환');
    for(const [value,label] of [['blossom','🌸 길드'],['ubitetamer','🎮 전체']]){
      const b=node('button','',label);b.type='button';b.dataset.room=value;b.setAttribute('aria-pressed','false');
      b.onclick=()=>applyRoom(value);room.append(b);
    }
    const right=node('div','bsh-right');
    const account=node('details','bsh-dropdown bsh-account');
    const accountSummary=node('summary','bsh-summary');accountSummary.id='bshUserBadge';accountSummary.textContent='회원 확인 중';
    const accountItems=node('div','bsh-dropdown-menu');accountItems.id='bshUserLinks';
    account.append(accountSummary,accountItems);
    const more=node('details','bsh-dropdown bsh-more');
    more.append(node('summary','bsh-summary','☰ 전체 메뉴'));
    const moreItems=node('div','bsh-dropdown-menu');moreItems.id='bshMoreLinks';more.append(moreItems);
    right.append(more,account);inner.append(brand,nav,room,right);header.append(inner);
    document.body.prepend(header);
    const bottom=node('nav','bsh-mobile-bottom');bottom.id='bshMobileBottom';bottom.setAttribute('aria-label','모바일 주요 메뉴');
    const items=node('div','bsh-mobile-items');items.id='bshQuickLinks';bottom.append(items);document.body.append(bottom);
    document.addEventListener('click',e=>{
      for(const d of document.querySelectorAll('#bshHeader details[open]'))if(!d.contains(e.target))d.open=false;
    });
  }
  async function start(){
    const home=['','index.html'].includes(pageName());
    if(home)document.body.classList.add('bsh-home');
    document.body.dataset.bshRoom='ubitetamer';
    makeShell();state.loaded=false;renderMenus();updateHome();
    const hubSelector=$('#roomSelect');
    if(hubSelector){new MutationObserver(()=>{if(state.user)updatePublicHub();})
      .observe(hubSelector,{childList:true});}
    document.body.classList.add('blossom-shell-ready');
    try{
      const token=await getSession();
      if(!token?.access_token){state.loaded=true;renderMenus();return;}
      const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
      let response;
      try{response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token.access_token},body:JSON.stringify({action:'bootstrap'}),cache:'no-store',signal:controller.signal});}
      finally{clearTimeout(timeout);}
      const result=await response.json().catch(()=>null);
      if(!response.ok||!result?.success||!result?.user||!Array.isArray(result.rooms))throw Error('서버 확인 불가');
      state.user=result.user;state.rooms=result.rooms.filter(r=>r==='ubitetamer'||r==='blossom');
      if(!state.rooms.includes('ubitetamer'))state.rooms.unshift('ubitetamer');
      state.loaded=true;
      const key=userPrefKey();const saved=key?getSaved(key):null;
      const selected=state.rooms.includes(saved)?saved:
        (state.rooms.includes(result.user.default_room)?result.user.default_room:'ubitetamer');
      applyRoom(selected,false);
    }catch(err){
      // Fail closed: do not expose guild theme when membership cannot be verified.
      state.loaded=true;state.user=null;state.rooms=['ubitetamer'];applyRoom('ubitetamer',false);
      const badge=$('#bshUserBadge');if(badge)badge.textContent='회원 확인 필요';
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

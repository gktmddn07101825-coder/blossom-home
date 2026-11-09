/* BLOSSOM EVENT TIMELINE v5 — GitHub Pages, no third-party JS dependencies */
(() => {
  'use strict';
  const root = document.getElementById('blossomCalendar');
  if (!root) return;
  const API = 'https://hweouohzkwqhiwwsjlxu.supabase.co/functions/v1/blossom-calendar';
  const SESSION_KEY = 'blossom_test_auth_v1';
  const DAY = 86400000, COLUMN = 53, DAYS = 35, SEOUL_HOURS = 9;
  const CATEGORIES = {game:'🎮 게임 이벤트',guild:'🌸 길드 일정',notice:'📢 안내',maintenance:'🛠 점검',other:'✨ 기타'};
  const el = id => document.getElementById(id);
  let firstDay = seoulDayNumber(Date.now()) - 8;
  let events = [], canEdit = false, category = 'all', editing = null;
  let sequence = 0, saving = false;

  function dayNumberFromKey(key) { return Math.floor(Date.parse(key + 'T00:00:00Z') / DAY); }
  function keyFromDayNumber(num) { return new Date(num * DAY).toISOString().slice(0,10); }
  function seoulDateParts(value) {
    const parts = new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
    const lookup = Object.fromEntries(parts.map(x => [x.type,x.value]));
    return {year:Number(lookup.year),month:Number(lookup.month),day:Number(lookup.day)};
  }
  function seoulDayNumber(value) {
    const x=seoulDateParts(value);
    return Math.floor(Date.UTC(x.year,x.month-1,x.day)/DAY);
  }
  function keyFromSeoul(value) { const x=seoulDateParts(value);return `${x.year}-${String(x.month).padStart(2,'0')}-${String(x.day).padStart(2,'0')}`; }
  function seoulDayStartUtc(day) { return (day*DAY) - SEOUL_HOURS*3600000; }
  function dateTimeLocalSeoul(iso) { return new Date(Date.parse(iso)+SEOUL_HOURS*3600000).toISOString().slice(0,16); }
  function isoFromSeoulInput(text) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return null;
    const d = new Date(text+':00+09:00');
    if (!Number.isFinite(d.getTime()) || dateTimeLocalSeoul(d.toISOString()) !== text) return null;
    return d.toISOString();
  }
  function fmtDate(iso) { return new Date(iso).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}); }
  function timeLeft(target, now) {
    let n=Math.max(0,target-now);
    const d=Math.floor(n/DAY); n-=d*DAY;
    const h=Math.floor(n/3600000); n-=h*3600000;
    const m=Math.floor(n/60000);
    return (d ? d+'일 ' : '') + (h ? h+'시간 ' : '') + m+'분';
  }
  function statusText(event, now=Date.now()) {
    const s=Date.parse(event.start_at), e=Date.parse(event.end_at);
    if(now < s)return '시작까지 '+timeLeft(s,now);
    if(now >= e)return '종료';
    return '종료까지 '+timeLeft(e,now);
  }
  function token() {
    try { const s=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');
      if(s&&typeof s.access_token==='string'&&Number(s.expires_at)>Date.now()/1000+10)return s.access_token;
    }catch(_){} return '';
  }
  async function request(body){
    const access=token();
    if(!access)throw Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
    let response;
    try { response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+access},body:JSON.stringify(body),cache:'no-store'}); }
    catch(_){throw Error('서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.');}
    const data=await response.json().catch(()=>null);
    if(!data||!response.ok||!data.success)throw Error(data?.message||'일정 요청이 실패했습니다.');
    return data;
  }
  function node(tag, css='', value){ const e=document.createElement(tag);if(css)e.className=css;if(value!==undefined)e.textContent=value;return e; }
  function message(text, err=false){ el('bcStatus').textContent=text;el('bcStatus').classList.toggle('error',err); }
  function updateClock(){
    const now=Date.now();
    el('bcClock').textContent='KST '+new Date(now).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
    const nowline=el('bcNowline');
    const x=(now-seoulDayStartUtc(firstDay))/DAY*COLUMN;
    nowline.hidden=x<0||x>DAYS*COLUMN;nowline.style.left=x+'px';
    root.querySelectorAll('[data-countdown-id]').forEach(chip=>{
      const event=events.find(e=>e.id===chip.dataset.countdownId);
      if(event)chip.textContent=statusText(event,now);
    });
  }
  function daysHeader(){
    const out=el('bcDays');out.replaceChildren();
    const monthLabels=[];
    for(let i=0;i<DAYS;i++){
      const day=firstDay+i;
      const dt=new Date(day*DAY), year=dt.getUTCFullYear(), month=dt.getUTCMonth()+1, d=dt.getUTCDate();
      const weekday=dt.getUTCDay(), isToday=day===seoulDayNumber(Date.now());
      const col=node('div','bc-day'+((weekday===0||weekday===6)?' bc-weekend':'')+(isToday?' bc-today':''));
      const week=node('span','bc-week',['일','월','화','수','목','금','토'][weekday]);
      const dayDate=node('span','bc-date',String(d));
      col.append(week,dayDate);
      if(d===1 || i===0){ const label=node('span','bc-month-label',month+'월');col.append(label);monthLabels.push(month+'월'); }
      out.append(col);
    }
    const rangeStart=new Date(firstDay*DAY);
    const rangeEnd=new Date((firstDay+DAYS-1)*DAY);
    const short=d=>d.getUTCFullYear()+'. '+(d.getUTCMonth()+1)+'. '+d.getUTCDate()+'.';
    el('bcRangeLabel').textContent=short(rangeStart)+' — '+short(rangeEnd);
    el('bcMonth').value=keyFromDayNumber(firstDay+8).slice(0,7);
  }
  function filteredEvents(){return events.filter(e=>category==='all'||e.category===category).sort((a,b)=>{
    return (Number(a.sort_order)-Number(b.sort_order))||(Date.parse(a.start_at)-Date.parse(b.start_at));
  });}
  function render(){
    daysHeader();
    const track=el('bcRows');track.replaceChildren();
    const visible=filteredEvents();
    if(!visible.length){
      const empty=node('div','bc-empty');
      empty.append(node('strong','',events.length?'선택한 종류의 일정이 없습니다':'이 기간에 등록된 이벤트가 없습니다'));
      empty.append(node('span','',canEdit?'오른쪽의 ‘이벤트 등록’ 버튼으로 첫 일정을 추가해 보세요.':'운영진이 이벤트를 등록하면 이곳에 기간 막대로 표시됩니다.'));
      track.append(empty);
    } else {
      const viewStart=seoulDayStartUtc(firstDay),viewEnd=seoulDayStartUtc(firstDay+DAYS);
      for(const event of visible){
        const start=Date.parse(event.start_at),end=Date.parse(event.end_at);
        if(!Number.isFinite(start)||!Number.isFinite(end)||start>=viewEnd||end<=viewStart)continue;
        const row=node('div','bc-row');
        const left=Math.max(0,(start-viewStart)/DAY*COLUMN);
        const right=Math.min(DAYS*COLUMN,(end-viewStart)/DAY*COLUMN);
        const width=Math.max(9,right-left);
        const short=width<130;
        const bar=node('button','bc-bar'+(short?' bc-bar-small':'')+(event.is_visible===false?' bc-bar-draft':''));
        bar.type='button';bar.style.left=left+'px';bar.style.width=width+'px';
        const safeColor=/^#[\da-fA-F]{6}$/.test(event.color||'')?event.color:'#8B7BFF';
        bar.style.setProperty('--bar-color',safeColor);
        bar.setAttribute('aria-label',event.title+' / '+fmtDate(event.start_at)+' ~ '+fmtDate(event.end_at)+' / '+statusText(event));
        bar.title=event.title+' · '+statusText(event);
        if(short){bar.textContent='✦';}else{
          bar.append(node('span','bc-bar-title',(event.is_visible===false?'[숨김] ':'')+event.title));
        }
        if(event.banner_url && /^https:\/\//i.test(event.banner_url)){
          // JSON.stringify quotes the URL safely in CSS url("...") format.
          try{bar.style.backgroundImage='linear-gradient(90deg,'+safeColor+'e8,'+safeColor+'99),url('+JSON.stringify(new URL(event.banner_url).href)+')';bar.style.backgroundSize='cover';bar.style.backgroundPosition='center';}catch(_){}
        }
        bar.addEventListener('click',()=>showDetails(event));
        row.append(bar);
        const countdown=node('span','bc-countdown',statusText(event));
        countdown.dataset.countdownId=event.id;
        countdown.style.left=Math.min(Math.max(8,right+7),DAYS*COLUMN-166)+'px';
        row.append(countdown);
        track.append(row);
      }
    }
    el('bcCount').textContent=visible.length+'개 일정';
    el('bcEditorSection').hidden=!canEdit;
    el('bcCreateButton').hidden=!canEdit;
    updateClock();
  }
  async function load(){
    const current=++sequence;
    el('bcReload').disabled=true;
    message('이벤트 일정을 불러오는 중...');
    const from=keyFromDayNumber(firstDay)+'T00:00:00+09:00';
    const to=keyFromDayNumber(firstDay+DAYS)+'T00:00:00+09:00';
    try{
      const data=await request({action:'list',from,to});
      if(current!==sequence)return;
      events=Array.isArray(data.events)?data.events:[];
      canEdit=data.can_edit===true;
      render();message('일정 '+events.length+'개를 불러왔습니다.');
      if(canEdit&&location.hash==='#calendarManage')el('bcEditorSection').scrollIntoView({behavior:'smooth',block:'start'});
    }catch(err){
      if(current!==sequence)return;
      events=[];canEdit=false;render();message(err.message||'일정을 불러오지 못했습니다.',true);
    }finally{if(current===sequence)el('bcReload').disabled=false;}
  }
  function clearEditor(){
    editing=null;el('bcForm').reset();el('bcFormTitle').textContent='✦ 새 이벤트 등록';el('bcSave').textContent='등록하기';el('bcCancel').hidden=true;
    el('bcCategoryInput').value='game';el('bcColorInput').value='#8b7bff';el('bcVisibleInput').checked=true;
    const now=new Date(Date.now()+SEOUL_HOURS*3600000);
    const rounded=now.toISOString().slice(0,11)+'09:00';
    const nextDay=new Date(now.getTime()+DAY).toISOString().slice(0,11)+'09:00';
    el('bcStartInput').value=rounded;el('bcEndInput').value=nextDay;
  }
  function beginEdit(event){
    if(!canEdit)return;
    editing=event.id;
    el('bcFormTitle').textContent='✎ 이벤트 수정';el('bcSave').textContent='수정 저장';el('bcCancel').hidden=false;
    el('bcTitleInput').value=event.title;
    el('bcDescriptionInput').value=event.description||'';
    el('bcCategoryInput').value=event.category;
    el('bcStartInput').value=dateTimeLocalSeoul(event.start_at);
    el('bcEndInput').value=dateTimeLocalSeoul(event.end_at);
    el('bcColorInput').value=event.color||'#8b7bff';
    el('bcBannerInput').value=event.banner_url||'';
    el('bcOrderInput').value=Number(event.sort_order)||0;
    el('bcVisibleInput').checked=event.is_visible!==false;
    el('bcEditorSection').hidden=false;
    el('bcEditorSection').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function showDetails(event){
    const dialog=el('bcDetail');
    el('bcDetailKind').textContent=CATEGORIES[event.category]||'이벤트';
    el('bcDetailTitle').textContent=event.title;
    el('bcDetailDates').textContent='🗓 '+fmtDate(event.start_at)+' ~ '+fmtDate(event.end_at)+' (한국 시간)';
    el('bcDetailCountdown').textContent='⏳ '+statusText(event);
    el('bcDetailDescription').textContent=event.description||'상세 설명이 없습니다.';
    el('bcDetailVisibility').textContent=event.is_visible===false?'🔒 비공개 · 운영진에게만 보이는 일정':'🌸 길드원에게 공개된 일정';
    el('bcDetailEdit').hidden=!canEdit;
    el('bcDetailDelete').hidden=!canEdit;
    el('bcDetailVisibilityButton').hidden=!canEdit;
    el('bcDetailVisibilityButton').textContent=event.is_visible===false?'공개하기':'숨기기';
    el('bcDetailEdit').onclick=()=>{dialog.close();beginEdit(event);};
    el('bcDetailDelete').onclick=()=>{dialog.close();removeEvent(event);};
    el('bcDetailVisibilityButton').onclick=()=>{dialog.close();setVisibility(event);};
    dialog.showModal();
  }
  function toPayload(){
    const start=isoFromSeoulInput(el('bcStartInput').value),end=isoFromSeoulInput(el('bcEndInput').value);
    if(!start||!end||Date.parse(end)<=Date.parse(start))throw Error('종료 날짜·시간은 시작보다 나중이어야 합니다.');
    if(Date.parse(end)-Date.parse(start)>730*DAY)throw Error('기간은 최대 2년까지 등록할 수 있어요.');
    return {title:el('bcTitleInput').value.trim(),description:el('bcDescriptionInput').value.trim(),
      category:el('bcCategoryInput').value,start_at:start,end_at:end,
      color:el('bcColorInput').value,banner_url:el('bcBannerInput').value.trim()||null,
      sort_order:Number(el('bcOrderInput').value),is_visible:el('bcVisibleInput').checked};
  }
  async function handleSave(e){
    e.preventDefault(); if(saving||!canEdit)return;
    let payload;try{payload=toPayload();}catch(err){message(err.message,true);return;}
    if(payload.title.length<2||payload.title.length>120){message('제목을 2~120자로 입력해 주세요.',true);return;}
    saving=true;el('bcSave').disabled=true;message('이벤트를 저장하고 있어요...');
    try{
      const result=await request({action:editing?'update':'create',...(editing?{event_id:editing}:{}),...payload});
      const key=seoulDayNumber(Date.parse(payload.start_at));
      if(key<firstDay || key>=firstDay+DAYS) firstDay=key-8;
      clearEditor();await load();message(result.message);
    }catch(err){message(err.message||'저장에 실패했습니다.',true);}
    finally{saving=false;el('bcSave').disabled=false;}
  }
  async function removeEvent(event){
    if(!canEdit||saving||!confirm('「'+event.title+'」 이벤트를 영구 삭제할까요?'))return;
    saving=true;message('이벤트 삭제 중...');
    try{const result=await request({action:'delete',event_id:event.id});await load();message(result.message);}catch(err){message(err.message,true);}finally{saving=false;}
  }
  async function setVisibility(event){
    if(!canEdit||saving)return;
    saving=true;message('공개 설정 변경 중...');
    try{const result=await request({action:'visibility',event_id:event.id,is_visible:!event.is_visible});await load();message(result.message);}catch(err){message(err.message,true);}finally{saving=false;}
  }
  el('bcPrev').addEventListener('click',()=>{firstDay-=14;load();});
  el('bcNext').addEventListener('click',()=>{firstDay+=14;load();});
  el('bcToday').addEventListener('click',()=>{firstDay=seoulDayNumber(Date.now())-8;load();});
  el('bcMonth').addEventListener('change',e=>{
    const v=e.target.value;
    if(/^\d{4}-\d{2}$/.test(v)){firstDay=dayNumberFromKey(v+'-01');load();}
  });
  el('bcCategory').addEventListener('change',e=>{category=e.target.value;render();});
  el('bcReload').addEventListener('click',load);
  el('bcCreateButton').addEventListener('click',()=>{clearEditor();el('bcEditorSection').scrollIntoView({behavior:'smooth',block:'start'});el('bcTitleInput').focus({preventScroll:true});});
  el('bcCancel').addEventListener('click',clearEditor);
  el('bcForm').addEventListener('submit',handleSave);
  el('bcDetailClose').addEventListener('click',()=>el('bcDetail').close());
  el('bcDetail').addEventListener('click',e=>{if(e.target===el('bcDetail'))el('bcDetail').close();});
  clearEditor();daysHeader();updateClock();setInterval(updateClock,1000);
  window.addEventListener('blossom:authorized',load);
  if(document.documentElement.dataset.blossomAccess==='approved')load();
})();

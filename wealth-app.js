/* BLOSSOM 개인 수익 캘린더 v1. Only the authenticated account's data is loaded from Supabase. */
(() => {
  'use strict';
  const API = 'https://hweouohzkwqhiwwsjlxu.supabase.co/functions/v1/blossom-wealth';
  const SESSION_KEY = 'blossom_test_auth_v1';
  const MILLION = 1000000; // B per T
  const THOUSAND = 1000;   // B per M
  const MAX_B = 1000000000000;
  const FIELDS = {
    hunting_b: 'huntMoney',
    dungeon_b: 'dungeonMoney',
    sales_b: 'salesMoney',
    other_b: 'otherMoney',
    expense_b: 'expenseMoney',
  };
  const $ = id => document.getElementById(id);
  const state = {
    settings: null,
    days: new Map(),
    selected: koreaToday(),
    shownMonth: koreaToday().slice(0, 7),
    loaded: false,
    saving: null,
    dirty: false,
    revision: 0,
    started: false,
  };
  let saveTimer = null;
  const dateFormat = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', timeZone: 'UTC' });

  function koreaToday() {
    return new Date(Date.now() + 9 * 3600000).toISOString().slice(0,10);
  }
  function dateUTC(str) { return new Date(str + 'T00:00:00.000Z'); }
  function toDateStr(date) { return date.toISOString().slice(0,10); }
  function shiftDay(day, amount) {
    return toDateStr(new Date(dateUTC(day).getTime() + amount * 86400000));
  }
  function isDate(v) {
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      !Number.isNaN(dateUTC(v).getTime()) && toDateStr(dateUTC(v)) === v;
  }
  function number(v) {
    const n = Number(v);
    return Number.isSafeInteger(n) && n >= 0 && n <= MAX_B ? n : 0;
  }
  function moneyFmt(b) {
    const sign = b < 0 ? '−' : '';
    let n = Math.abs(Math.trunc(b));
    const T = Math.floor(n / MILLION); n %= MILLION;
    const M = Math.floor(n / THOUSAND); const B = n % THOUSAND;
    const out = [];
    if (T) out.push(T.toLocaleString('ko-KR') + 'T');
    if (M) out.push(M.toLocaleString('ko-KR') + 'M');
    if (B) out.push(B.toLocaleString('ko-KR') + 'B');
    return sign + (out.join(' ') || '0B');
  }
  function shortMoney(b) {
    if (!b) return '0';
    const n = Math.abs(b), sign = b < 0 ? '−' : '+';
    if (n >= MILLION) return sign + (n/MILLION).toLocaleString('ko-KR',{maximumFractionDigits:2}) + 'T';
    if (n >= THOUSAND) return sign + (n/THOUSAND).toLocaleString('ko-KR',{maximumFractionDigits:1}) + 'M';
    return sign + n.toLocaleString('ko-KR') + 'B';
  }
  function parseMoney(value) {
    const s = String(value || '').trim().toUpperCase().replace(/,/g, '');
    if (!s) return 0;
    let b = 0;
    if (/^\d+(?:\.\d+)?$/.test(s)) {
      b = Number(s) * MILLION; // No unit = T
    } else {
      const regex = /(\d+(?:\.\d+)?)\s*([TMB])/g;
      let last = 0, match, count = 0;
      while ((match = regex.exec(s)) !== null) {
        if (s.slice(last, match.index).trim()) throw Error('금액은 12T 350M 또는 12.5처럼 입력해 주세요.');
        const mult = match[2] === 'T' ? MILLION : match[2] === 'M' ? THOUSAND : 1;
        b += Number(match[1]) * mult;
        last = regex.lastIndex;
        count++;
      }
      if (!count || s.slice(last).trim()) throw Error('금액은 12T 350M 또는 12.5처럼 입력해 주세요.');
    }
    if (!Number.isFinite(b) || b < 0 || b > MAX_B || Math.abs(b - Math.round(b)) > 0.00001) {
      throw Error('금액이 너무 크거나 B보다 작은 단위까지 입력됐어요.');
    }
    return Math.round(b);
  }
  function netOf(r) {
    return number(r.hunting_b) + number(r.dungeon_b) + number(r.sales_b) + number(r.other_b) - number(r.expense_b);
  }
  function isBlankDay(row) {
    return !row.memo && Object.keys(FIELDS).every(key => !number(row[key]));
  }
  function setGlobal(message, isError = false) {
    $('globalMessage').textContent = message;
    $('globalMessage').classList.toggle('is-error', !!isError);
  }
  function setSaved(message, isError = false) {
    $('saveState').textContent = message;
    $('saveState').classList.toggle('is-error', !!isError);
  }
  async function getSession() {
    if (window.BlossomSession?.get) {
      const s = await window.BlossomSession.get();
      if (s?.access_token) return s;
    }
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (s?.access_token && Number(s.expires_at)>Date.now()/1000+5) return s;
    } catch (_) {}
    return null;
  }
  async function call(payload) {
    const s = await getSession();
    if (!s) throw Error('로그인이 만료됐어요. 다시 로그인해 주세요.');
    let response;
    try {
      response = await fetch(API, {
        method: 'POST',
        headers: {'Content-Type': 'application/json','Authorization': 'Bearer ' + s.access_token},
        body: JSON.stringify(payload),
        cache: 'no-store',
      });
    } catch (_) {
      throw Error('네트워크를 확인해 주세요.');
    }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw Error(data?.message || '서버 처리 중 문제가 발생했습니다.');
    return data;
  }
  async function fetchAll() {
    setGlobal('내 기록을 서버에서 불러오고 있어요...');
    const data = await call({action:'list'});
    state.settings = data.settings || null;
    state.days = new Map((data.entries || []).map(row => [row.entry_date, row]));
    state.loaded = true;
    const t = koreaToday();
    $('entryDate').max = t;
    if (state.selected > t) state.selected = t;
    fillGoal();
    fillDay();
    renderAll();
    $('wealthApp').hidden = false;
    setGlobal('✓ 내 계정의 기록이 안전하게 연결됐습니다.');
    if (!state.settings) {
      $('goalForm').hidden = false;
      $('goalToggle').setAttribute('aria-expanded','true');
      setGlobal('🎯 먼저 목표 금액과 현재 보유금을 입력해 주세요.');
    }
  }
  function fillGoal() {
    $('goalName').value = state.settings?.goal_name || '나의 T 모으기';
    $('startingMoney').value = state.settings ? moneyFmt(number(state.settings.starting_b)) : '';
    $('goalMoney').value = state.settings ? moneyFmt(number(state.settings.goal_b)) : '';
  }
  function fillDay() {
    const row = state.days.get(state.selected) || {};
    $('entryDate').value = state.selected;
    for (const [field,id] of Object.entries(FIELDS)) {
      $(id).value = number(row[field]) ? moneyFmt(number(row[field])) : '';
    }
    $('entryMemo').value = row.memo || '';
    $('clearDay').disabled = !state.days.has(state.selected);
    state.dirty = false;
    setSaved(state.days.has(state.selected) ? '✓ 저장된 기록' : '새 기록');
    previewNet();
  }
  function readDay() {
    const row = {entry_date:state.selected};
    for (const [field,id] of Object.entries(FIELDS)) row[field] = parseMoney($(id).value);
    row.memo = $('entryMemo').value.trim();
    if (row.memo.length > 240) throw Error('메모는 240자까지 작성해 주세요.');
    return row;
  }
  function previewNet() {
    try {
      const amount = netOf(readDay());
      $('draftNet').textContent = moneyFmt(amount);
      $('draftNet').classList.toggle('negative',amount<0);
    } catch (_) {
      $('draftNet').textContent = '금액 확인 필요';
      $('draftNet').classList.add('negative');
    }
  }
  function scheduleSave() {
    if (!state.loaded) return;
    state.dirty = true;
    state.revision++;
    setSaved('● 입력 중… 자동 저장 예정');
    previewNet();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { flushDay().catch(() => {}); }, 1200);
  }
  async function flushDay() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (state.saving) {
      try { await state.saving; } catch (_) { return false; }
    }
    if (!state.dirty) return true;
    let row;
    try { row = readDay(); }
    catch (e) { setSaved(e.message || '금액을 확인해 주세요.',true); return false; }
    const revision = state.revision;
    setSaved('서버에 저장 중…');
    state.saving = call({action:'save_day',...row});
    try {
      await state.saving;
      state.days.set(row.entry_date,row);
      if (revision === state.revision) state.dirty = false;
      renderAll();
      setSaved(state.dirty ? '변경된 내용을 다시 저장하는 중…' : '✓ 자동 저장 완료');
    } catch (e) {
      setSaved(e.message || '저장에 실패했어요.',true);
      return false;
    } finally {
      state.saving = null;
    }
    // A user may have typed again while the previous save was in flight.
    return state.dirty ? await flushDay() : true;
  }
  async function changeDay(day) {
    if (!isDate(day) || day > koreaToday() || day < '2020-01-01') return;
    if (day===state.selected) return;
    if (!(await flushDay())) return;
    state.selected = day;
    state.shownMonth = day.slice(0,7);
    fillDay();
    renderAll();
  }
  function setGoalForm(open) {
    $('goalForm').hidden = !open;
    $('goalToggle').setAttribute('aria-expanded', String(open));
    if (open) fillGoal();
  }
  async function saveGoal(event) {
    event.preventDefault();
    let goal_b, starting_b;
    try {
      goal_b = parseMoney($('goalMoney').value);
      starting_b = parseMoney($('startingMoney').value);
    } catch (e) { setGlobal(e.message,true); return; }
    const goal_name = $('goalName').value.trim();
    if (!goal_name || goal_name.length > 80) { setGlobal('목표 이름을 입력해 주세요.',true); return; }
    $('saveGoal').disabled=true;
    try {
      await call({action:'settings',goal_name,goal_b,starting_b});
      state.settings={goal_name,goal_b,starting_b};
      setGoalForm(false);
      renderAll();
      setGlobal('✓ 목표와 보유금이 저장됐어요. 다른 길드원에게는 보이지 않아요.');
    } catch (e) { setGlobal(e.message,true); }
    finally { $('saveGoal').disabled=false; }
  }
  async function deleteDay() {
    if (!state.days.has(state.selected)) return;
    if (!confirm(state.selected + ' 수익 기록을 삭제할까요?')) return;
    clearTimeout(saveTimer);
    saveTimer=null;
    if(state.saving){try{await state.saving;}catch(_){}}
    const day=state.selected;
    setSaved('기록 삭제 중…');
    try {
      await call({action:'delete_day',entry_date:day});
      state.days.delete(day);
      state.revision++;
      fillDay();
      renderAll();
      setSaved('✓ 날짜 기록을 삭제했어요.');
    } catch(e) {setSaved(e.message,true);}
  }
  function summary() {
    const today=koreaToday();
    const entries=[...state.days.values()].filter(r=>r.entry_date<=today);
    const total=entries.reduce((sum,r)=>sum+netOf(r),0);
    const current=number(state.settings?.starting_b)+total;
    const goal=number(state.settings?.goal_b);
    const sevenStart=shiftDay(today,-6);
    const lastWeek=entries.filter(r=>r.entry_date>=sevenStart);
    // Calendar-day average, including non-recorded days. The initial short period only
    // divides by elapsed calendar days since the first recorded day.
    const first=entries.length ? entries.reduce((min,r)=>r.entry_date<min?r.entry_date:min,entries[0].entry_date) : null;
    const elapsed=first ? Math.max(1,Math.min(7,Math.floor((dateUTC(today)-dateUTC(first))/86400000)+1)) : 7;
    const last7net=lastWeek.reduce((s,r)=>s+netOf(r),0);
    const avg=first ? last7net/elapsed : 0;
    const sinceTuesday=(dateUTC(today).getUTCDay()+5)%7;
    const tuesday=shiftDay(today,-sinceTuesday);
    const dungeonWeek=entries.filter(r=>r.entry_date>=tuesday).reduce((s,r)=>s+number(r.dungeon_b)+number(r.sales_b),0);
    return {today,current,goal,total,avg,elapsed,first,tuesday,dungeonWeek,last7net,todayNet:netOf(state.days.get(today)||{})};
  }
  function renderGoal(s) {
    $('goalDisplayName').textContent=state.settings?.goal_name||'목표 미설정';
    $('balanceText').textContent=moneyFmt(s.current);
    $('goalText').textContent='/ '+(s.goal>0?moneyFmt(s.goal):'목표 미설정');
    const rate=s.goal>0?Math.min(100,Math.max(0,100*s.current/s.goal)):0;
    $('goalBar').style.width=rate+'%';
    $('goalRate').textContent=s.goal>0?'달성률 '+rate.toFixed(1)+'%':'목표를 먼저 설정해 주세요';
    $('goalRemain').textContent=s.goal>0?'남은 금액 '+moneyFmt(Math.max(0,s.goal-s.current)):'—';
    if(!s.goal){$('forecastDate').textContent='목표를 설정해 주세요';$('forecastDesc').textContent='금액을 정하면 달성일을 계산해 드려요.';return;}
    if(s.current>=s.goal){$('forecastDate').textContent='🎉 목표 달성!';$('forecastDesc').textContent='새 목표를 정해서 계속 기록해 보세요.';return;}
    if(!s.first){$('forecastDate').textContent='기록 대기 중';$('forecastDesc').textContent='수익을 입력하면 목표일을 예측해 드려요.';return;}
    if(s.avg<=0){$('forecastDate').textContent='아직 예측 불가';$('forecastDesc').textContent='최근 평균 순수익이 0 이하라 달성일을 계산할 수 없어요.';return;}
    const remaining=s.goal-s.current;
    const days=Math.ceil(remaining/s.avg);
    if(days>36500){$('forecastDate').textContent='아주 먼 목표예요';$('forecastDesc').textContent='목표 금액 또는 최근 수익을 조정해 보세요.';return;}
    const arrival=shiftDay(s.today,days);
    $('forecastDate').textContent=arrival+' ('+days.toLocaleString('ko-KR')+'일 후)';
    $('forecastDesc').textContent='최근 '+s.elapsed+'일의 달력 기준 일평균 순수익으로 계산한 추정일이에요.';
  }
  function renderStats(s) {
    $('averageText').textContent=moneyFmt(Math.round(s.avg));
    $('dungeonWeekText').textContent=moneyFmt(s.dungeonWeek);
    $('todayText').textContent=moneyFmt(s.todayNet);
    $('totalText').textContent=moneyFmt(s.total);
  }
  function dateLabel(day) {
    return dateFormat.format(dateUTC(day));
  }
  function renderCalendar() {
    const month=state.shownMonth;
    const [year,m]=month.split('-').map(Number);
    $('monthLabel').textContent=year+'년 '+m+'월';
    $('monthNext').disabled=month>=koreaToday().slice(0,7);
    const first = new Date(Date.UTC(year,m-1,1));
    const offset=(first.getUTCDay()+6)%7;
    const count=new Date(Date.UTC(year,m,0)).getUTCDate();
    const cells=Math.ceil((offset+count)/7)*7;
    const host=$('calendarGrid');host.replaceChildren();
    for(let i=0;i<cells;i++){
      const d=toDateStr(new Date(Date.UTC(year,m-1,1-offset+i)));
      const r=state.days.get(d);
      const net=r?netOf(r):0;
      const btn=document.createElement('button');btn.type='button';
      const isCurrent=d.slice(0,7)===month;
      btn.className='calendar-day'+(!isCurrent?' current-month':'')+(d===state.selected?' selected':'')+(d===koreaToday()?' today':'');
      btn.disabled=d>koreaToday()||d<'2020-01-01';
      btn.setAttribute('aria-label',d+(r?', 순수익 '+moneyFmt(net):', 미기록'));
      if(d===state.selected)btn.setAttribute('aria-pressed','true');
      const dayNum=document.createElement('span');dayNum.className='day-num';dayNum.textContent=String(Number(d.slice(-2)));
      const money=document.createElement('span');money.className='day-amount '+(net>0?'up':net<0?'down':'zero');money.textContent=r?shortMoney(net):'·';
      btn.append(dayNum,money);
      btn.addEventListener('click',()=>{changeDay(d).catch(e=>setGlobal(e.message,true));});
      host.append(btn);
    }
  }
  function renderBars(s) {
    const host=$('recentBars');host.replaceChildren();
    const series=[];
    for(let i=6;i>=0;i--){const day=shiftDay(s.today,-i);series.push({date:day,net:netOf(state.days.get(day)||{})});}
    const maximum=Math.max(...series.map(x=>Math.abs(x.net)),1);
    for(const point of series){
      const col=document.createElement('div');col.className='bar-col';
      const value=document.createElement('span');value.className='bar-value';value.textContent=shortMoney(point.net);
      const track=document.createElement('div');track.className='bar-track';
      const fill=document.createElement('div');fill.className='bar-fill'+(point.net<0?' neg':'');fill.style.height=(Math.abs(point.net)/maximum*100)+'%';
      track.append(fill);
      const date=document.createElement('span');date.className='bar-date';date.textContent=dateLabel(point.date);
      col.append(value,track,date);host.append(col);
    }
    $('weekTotal').textContent='7일 합계 '+moneyFmt(s.last7net);
  }
  function renderAll() {
    if(!state.loaded)return;
    const stats=summary();
    renderGoal(stats);
    renderStats(stats);
    renderCalendar();
    renderBars(stats);
    $('clearDay').disabled=!state.days.has(state.selected);
  }
  function shiftMonth(offset) {
    const [year,month]=state.shownMonth.split('-').map(Number);
    const d=new Date(Date.UTC(year,month-1+offset,1));
    const next=d.toISOString().slice(0,7);
    if(next>'2100-12'||next<'2020-01'||next>koreaToday().slice(0,7))return;
    state.shownMonth=next;
    renderCalendar();
  }
  function listeners() {
    $('goalToggle').addEventListener('click',()=>setGoalForm($('goalForm').hidden));
    $('goalCancel').addEventListener('click',()=>setGoalForm(false));
    $('goalForm').addEventListener('submit',saveGoal);
    $('monthBack').addEventListener('click',()=>shiftMonth(-1));
    $('monthNext').addEventListener('click',()=>shiftMonth(1));
    $('todayButton').addEventListener('click',()=>{changeDay(koreaToday()).catch(e=>setGlobal(e.message,true));});
    $('entryDate').addEventListener('change',e=>{const next=e.target.value;changeDay(next).then(()=>{$('entryDate').value=state.selected;});});
    $('dayForm').addEventListener('submit',e=>{e.preventDefault();flushDay().catch(err=>setSaved(err.message,true));});
    $('clearDay').addEventListener('click',deleteDay);
    Object.values(FIELDS).concat('entryMemo').forEach(id=>$(id).addEventListener('input',scheduleSave));
    // Warn on unsaved input (e.g. invalid amount) rather than silently losing it.
    window.addEventListener('beforeunload',e=>{if(state.dirty){e.preventDefault();e.returnValue='';}});
  }
  async function init() {
    if(state.started)return;
    state.started=true;
    listeners();
    try {await fetchAll();}
    catch(e){state.started=false;setGlobal(e.message||'데이터를 불러오지 못했어요.',true);$('wealthApp').hidden=false;}
  }
  window.addEventListener('blossom:authorized',init);
  if(document.documentElement.dataset.blossomAccess==='approved')init();
})();

/* BLOSSOM TODO v7 — 모든 값은 Supabase 계정별 저장. localStorage 불필요. */
(() => {
  'use strict';
  const URL = 'https://hweouohzkwqhiwwsjlxu.supabase.co/functions/v1/blossom-todo';
  const SESSION_KEY = 'blossom_test_auth_v1';
  const $ = id => document.getElementById(id);
  const state = { templates: [], personal: [], overrides: [], progress: [], can_manage: false, role: 'member', periods: null };
  let cycle = 'daily';
  let busy = false;
  let started = false;
  let editPersonal = null;
  let editTemplate = null;

  function session() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (s && typeof s.access_token === 'string' && Number(s.expires_at) > Date.now() / 1000 + 5) return s;
    } catch (_) {}
    return null;
  }
  function message(value, isError = false) {
    const el = $('saveMessage');
    el.textContent = value;
    el.classList.toggle('error', !!isError);
  }
  function node(tag, cls = '', value = '') {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (value !== undefined) e.textContent = value;
    return e;
  }
  function button(value, cls = '') { const e = node('button', cls, value); e.type = 'button'; return e; }
  function numberOptions(select, initial = 1) {
    select.replaceChildren();
    for (let n = 1; n <= 20; n++) {
      const option = document.createElement('option');
      option.value = String(n);
      option.textContent = n + '회';
      select.append(option);
    }
    select.value = String(initial);
  }
  function progressFor(kind, id, taskCycle) {
    const p = state.periods;
    if (!p) return 0;
    const period = taskCycle === 'daily' ? p.daily : p.weekly;
    const row = state.progress.find(v => v.task_kind === kind && v.task_id === id && v.period_start === period);
    return Number(row?.completed_count) || 0;
  }
  function currentTasks(forCycle) {
    const overrides = new Map(state.overrides.map(x => [x.template_id, x.target]));
    const standard = state.templates.filter(x => x.is_active !== false && x.cycle === forCycle).map(x => ({
      id: x.id, kind: 'template', title: x.title, cycle: x.cycle,
      target: Number(overrides.get(x.id) ?? x.default_target),
      count: progressFor('template', x.id, x.cycle),
      sort_order: Number(x.sort_order) || 0,
    }));
    const custom = state.personal.filter(x => x.cycle === forCycle).map(x => ({
      id: x.id, kind: 'personal', title: x.title, cycle: x.cycle,
      target: Number(x.target), count: progressFor('personal', x.id, x.cycle),
      created_at: x.created_at,
    }));
    standard.sort((a,b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title, 'ko'));
    return standard.concat(custom);
  }
  function stats(taskCycle) {
    const tasks = currentTasks(taskCycle);
    const checked = tasks.filter(t => t.count >= t.target).length;
    return { total: tasks.length, checked, percent: tasks.length ? 100 * checked / tasks.length : 0 };
  }
  async function api(payload) {
    const s = session();
    if (!s) throw Error('로그인이 만료됐습니다. 로그인 후 다시 이용해 주세요.');
    let response;
    try { response = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token },
      body: JSON.stringify(payload), cache: 'no-store',
    }); } catch (_) { throw Error('서버에 연결되지 않습니다. 네트워크를 확인해 주세요.'); }
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) throw Error(result?.message || '저장 중 오류가 발생했습니다.');
    return result;
  }
  async function fetchData() {
    const data = await api({action:'list'});
    for (const name of ['templates', 'personal', 'overrides', 'progress']) state[name] = Array.isArray(data[name]) ? data[name] : [];
    state.can_manage = data.can_manage === true;
    state.role = data.role || 'member';
    state.periods = data.periods || null;
    render();
    return data;
  }
  async function refresh() {
    if (busy) return;
    busy = true;
    message('서버에서 최신 숙제를 확인하는 중...');
    try { await fetchData(); message('최신 숙제 목록을 불러왔습니다.'); }
    catch (e) { message(e.message || '데이터를 불러오지 못했습니다.', true); }
    finally { busy = false; }
  }
  async function save(payload, success) {
    if (busy) return false;
    busy = true;
    message('저장 중... 창을 닫지 마세요.');
    document.querySelectorAll('main button,main select,main input').forEach(el => { el.disabled = true; });
    try {
      await api(payload);
      await fetchData();
      message(success || '저장되었습니다.');
      return true;
    } catch (e) {
      render();
      message(e.message || '저장에 실패했습니다.', true);
      return false;
    } finally {
      busy = false;
      document.querySelectorAll('main button,main select,main input').forEach(el => { el.disabled = false; });
      // 완료 상태의 +/- 비활성화를 다시 정확히 적용합니다.
      render();
    }
  }
  function renderTask(task) {
    const done = task.count >= task.target;
    const card = node('article', 'task' + (done ? ' is-done' : ''));
    const top = node('div','task-top');
    const textBox = node('div');
    textBox.append(node('h3','task-title',task.title));
    const meta = node('div','task-meta');
    meta.append(node('span','task-label' + (task.kind === 'personal' ? ' custom' : ''),task.kind === 'template' ? '✦ 길드 기본' : '✿ 내 숙제'));
    if (done) meta.append(node('span','','✓ 이번 기간 완료'));
    textBox.append(meta);
    const right = node('label','task-target');
    right.append(document.createTextNode('목표 '));
    const select = document.createElement('select');
    numberOptions(select,task.target);
    select.setAttribute('aria-label',task.title+' 목표 횟수');
    select.addEventListener('change',async () => {
      const n = Number(select.value);
      if (task.kind === 'template') {
        await save({ action:'override', template_id:task.id, target:n }, '나만의 목표 횟수를 저장했습니다.');
      } else {
        await save({ action:'personal_update', personal_id:task.id, title:task.title, cycle:task.cycle, target:n }, '내 숙제 횟수를 저장했습니다.');
      }
    });
    right.append(select);
    top.append(textBox,right);
    card.append(top);

    const control = node('div','task-progress');
    const num = node('div','number-control');
    const minus = button('−','small'); minus.setAttribute('aria-label',task.title+' 진행 횟수 감소');
    const plus = button('+','small'); plus.setAttribute('aria-label',task.title+' 진행 횟수 증가');
    minus.disabled = task.count <= 0;
    plus.disabled = task.count >= task.target;
    const amount = node('strong','',Math.min(task.count,task.target)+' / '+task.target);
    minus.addEventListener('click',()=>save({action:'progress',task_kind:task.kind,task_id:task.id,completed_count:Math.max(0,Math.min(task.count,task.target)-1)},'진행 횟수를 저장했습니다.'));
    plus.addEventListener('click',()=>save({action:'progress',task_kind:task.kind,task_id:task.id,completed_count:Math.min(task.target,task.count+1)},'진행 횟수를 저장했습니다.'));
    num.append(minus,amount,plus);
    const check = node('label','check-wrap'+(done?' is-done':''));
    const checkInput = document.createElement('input'); checkInput.type='checkbox'; checkInput.checked = done;
    checkInput.setAttribute('aria-label',task.title+' 완료 체크');
    checkInput.addEventListener('change',()=>save({action:'progress',task_kind:task.kind,task_id:task.id,completed_count:checkInput.checked?task.target:0},checkInput.checked?'숙제 완료! 저장했습니다.':'완료 체크를 해제했습니다.'));
    check.append(checkInput,node('span','',done?'완료':'완료 체크'));
    control.append(num,check);
    card.append(control);

    const meter = node('div','meter');
    const fill = node('div','fill'); fill.style.width=Math.max(0,Math.min(100,task.count/task.target*100))+'%'; meter.append(fill); card.append(meter);
    const foot = node('div','task-foot');
    foot.append(node('span','',done?'이번 기간 완료됨 · 다음 초기화 때 자동 해제':'클릭할 때마다 Supabase에 즉시 저장'));
    if (task.kind === 'personal') {
      const actions = node('div');
      const edit = button('수정','secondary');
      edit.addEventListener('click',()=>editOwn(task));
      const del = button('삭제','danger'); del.style.marginLeft='6px';
      del.addEventListener('click',async()=>{
        if (busy || !confirm('내 숙제 「'+task.title+'」을(를) 삭제할까요?\n삭제한 숙제와 해당 진행 기록은 되돌릴 수 없습니다.'))return;
        await save({action:'personal_delete',personal_id:task.id},'내 숙제를 삭제했습니다.');
      });
      actions.append(edit,del);foot.append(actions);
    }
    card.append(foot);
    return card;
  }
  function renderTasks() {
    const list = $('taskList'); list.replaceChildren();
    const tasks = currentTasks(cycle);
    $('countBadge').textContent = tasks.length + '개 숙제';
    $('listTitle').textContent = cycle === 'daily' ? '☀ 일일 숙제' : '✦ 주간 숙제';
    $('listSub').textContent = cycle === 'daily' ? '매일 00:00(한국 시간)에 완료 기록만 초기화' : '매주 화요일 00:00(한국 시간)에 완료 기록만 초기화';
    document.querySelectorAll('[data-cycle]').forEach(t => { const selected = t.dataset.cycle === cycle; t.classList.toggle('active',selected); t.setAttribute('aria-selected',String(selected)); });
    if (!tasks.length) {
      list.append(node('div','empty',state.can_manage?'이 종류의 숙제가 없어요. 관리자 기본 숙제를 등록하거나 내 숙제를 추가해 보세요.':'아직 등록된 숙제가 없어요. 아래에서 내 숙제를 추가할 수 있습니다.'));
    } else tasks.forEach(t => list.append(renderTask(t)));
  }
  function showStats() {
    for (const t of ['daily','weekly']) {
      const value = stats(t);
      $(t+'Number').textContent = value.checked+' / '+value.total;
      $(t+'Bar').style.width = value.percent+'%';
    }
    const s = session();
    $('ownerBadge').textContent = s ? ((s.digimon_nickname || s.username || '길드원') + ' 님 · '+(state.can_manage?'운영진 이상':'길드원')) : '길드원';
    updateClock();
  }
  function updateClock() {
    if (!state.periods) return;
    const now = Date.now();
    const until = Date.parse(cycle === 'daily' ? state.periods.next_daily_reset_at : state.periods.next_weekly_reset_at);
    if (!Number.isFinite(until)) return;
    const minutes = Math.max(0,Math.ceil((until-now)/60000));
    const d = Math.floor(minutes / 1440), h = Math.floor(minutes % 1440 / 60), m = minutes % 60;
    $('nextReset').textContent = (d?d+'일 ':'') + h+'시간 '+m+'분';
    $('resetHint').textContent = cycle === 'daily' ? '일일 숙제 → 내일 00:00' : '주간 숙제 → 화요일 00:00';
  }
  function resetPersonalForm() {
    editPersonal=null;$('personalForm').reset();$('mySubmit').textContent='내 숙제 추가';$('myCancel').hidden=true;numberOptions($('myTarget'));
  }
  function editOwn(task) {
    editPersonal=task.id;
    $('myTitle').value=task.title;$('myCycle').value=task.cycle;$('myTarget').value=String(task.target);
    $('mySubmit').textContent='내 숙제 수정 저장';$('myCancel').hidden=false;
    $('myTasks').scrollIntoView({behavior:'smooth',block:'start'});$('myTitle').focus();
  }
  function resetTemplateForm() {
    editTemplate=null;$('templateForm').reset();$('adminSubmit').textContent='기본 숙제 등록';$('adminCancel').hidden=true;numberOptions($('adminTarget'));
  }
  function editStandard(t) {
    editTemplate=t.id;
    $('adminTitle').value=t.title;$('adminCycle').value=t.cycle;$('adminTarget').value=String(t.default_target);
    $('adminSubmit').textContent='기본 숙제 수정 저장';$('adminCancel').hidden=false;
    $('adminPanel').scrollIntoView({behavior:'smooth',block:'start'});$('adminTitle').focus();
  }
  function renderAdmin() {
    $('adminPanel').hidden = !state.can_manage;
    if (!state.can_manage) return;
    const list = $('templateList');list.replaceChildren();
    if (!state.templates.length) {
      list.append(node('div','empty','아직 길드 기본 숙제가 없습니다. 위에서 기본 숙제를 하나 등록해 보세요.'));return;
    }
    for (const t of state.templates) {
      const row = node('div','admin-row'+(t.is_active?'':' off'));
      const box = node('div');box.append(node('strong','',t.title));
      box.append(node('small','',(t.cycle==='daily'?'일일':'주간')+' · 기본 '+t.default_target+'회 · '+(t.is_active?'사용 중':'숨김')));
      const actions = node('div');
      const edit = button('수정','secondary');
      edit.addEventListener('click',()=>editStandard(t));
      const active = button(t.is_active?'숨기기':'다시 표시',t.is_active?'danger':'secondary');
      active.style.marginLeft='8px';
      active.addEventListener('click',async()=>{
        if (busy || (t.is_active && !confirm('기본 숙제 「'+t.title+'」를 길드원 목록에서 숨길까요?\n기존 회원의 개인 숙제는 삭제되지 않습니다.')))return;
        await save({action:'template_active',template_id:t.id,is_active:!t.is_active},'기본 숙제 공개 상태를 변경했습니다.');
      });
      actions.append(edit,active);row.append(box,actions);list.append(row);
    }
  }
  function render() { renderTasks();showStats();renderAdmin(); }
  function initialize() {
    if (started) return;
    started=true;
    numberOptions($('myTarget'));numberOptions($('adminTarget'));
    document.querySelectorAll('[data-cycle]').forEach(b => b.addEventListener('click',()=>{
      if (busy) return;cycle=b.dataset.cycle;render();
    }));
    $('reload').addEventListener('click',refresh);
    $('myCancel').addEventListener('click',resetPersonalForm);
    $('adminCancel').addEventListener('click',resetTemplateForm);
    $('personalForm').addEventListener('submit',async (ev)=>{
      ev.preventDefault();if(busy)return;
      const title=$('myTitle').value.trim();
      const c=$('myCycle').value,t=Number($('myTarget').value);
      if (!title) return message('내 숙제 이름을 입력해 주세요.',true);
      const payload=editPersonal?{action:'personal_update',personal_id:editPersonal,title,cycle:c,target:t}:{action:'personal_create',title,cycle:c,target:t};
      if (await save(payload,editPersonal?'내 숙제를 수정했습니다.':'내 숙제를 추가했습니다.')){resetPersonalForm();cycle=c;render();}
    });
    $('templateForm').addEventListener('submit',async (ev)=>{
      ev.preventDefault();if(busy)return;
      const title=$('adminTitle').value.trim();const c=$('adminCycle').value;const t=Number($('adminTarget').value);
      const payload=editTemplate?{action:'template_update',template_id:editTemplate,title,cycle:c,default_target:t}:{action:'template_create',title,cycle:c,default_target:t};
      if (await save(payload,editTemplate?'기본 숙제를 수정했습니다.':'길드 기본 숙제를 등록했습니다.')){resetTemplateForm();cycle=c;render();}
    });
    window.addEventListener('beforeunload',ev=>{
      if (busy) { ev.preventDefault(); ev.returnValue=''; }
    });
    document.addEventListener('visibilitychange',()=>{
      if (!document.hidden && !busy && state.periods && (Date.now()>=Date.parse(state.periods.next_daily_reset_at) || Date.now()>=Date.parse(state.periods.next_weekly_reset_at))) refresh();
    });
    setInterval(()=>{
      if (!started || !state.periods || document.hidden) return;
      if (!busy && (Date.now()>=Date.parse(state.periods.next_daily_reset_at) || Date.now()>=Date.parse(state.periods.next_weekly_reset_at))) refresh();
      else updateClock();
    }, 15000);
    refresh();
  }
  window.addEventListener('blossom:authorized', initialize);
  if (document.documentElement.dataset.blossomAccess === 'approved') initialize();
})();

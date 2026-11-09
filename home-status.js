/* BLOSSOM 홈 대시보드 v9 — 사용자별 숙제·버프 상태 읽기 전용 표시 */
(() => {
  'use strict';

  const ROOT = 'https://hweouohzkwqhiwwsjlxu.supabase.co/functions/v1/';
  const SESSION_KEY = 'blossom_test_auth_v1';
  const todoStats = document.getElementById('homeTodoStats');
  const buffStats = document.getElementById('homeBuffStats');
  const todoMini = document.getElementById('homeTodoMini');
  const buffMini = document.getElementById('homeBuffMini');
  if (!todoStats || !buffStats || !todoMini || !buffMini) return;

  let buffItems = [];
  let loading = false;
  let refreshTime = 0;

  function node(tag, klass = '', text = undefined) {
    const item = document.createElement(tag);
    if (klass) item.className = klass;
    if (text !== undefined) item.textContent = String(text);
    return item;
  }
  function activeSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (s && s.status === 'approved' && typeof s.access_token === 'string' &&
          Number(s.expires_at) > Date.now() / 1000 + 15) return s;
    } catch (_) { /* 손상된 세션은 미로그인 처리 */ }
    return null;
  }
  function message(target, text, href, title) {
    target.replaceChildren();
    const label = node('div', 'hd-empty', text);
    target.append(label);
    if (href) {
      const a = node('a', 'hd-action', title || '바로가기 ↗');
      a.href = href;
      target.append(a);
    }
  }
  async function api(functionName, token) {
    const r = await fetch(ROOT + functionName, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action: 'list' }),
      cache: 'no-store',
    });
    const data = await r.json().catch(() => null);
    if (!r.ok || data?.success !== true) {
      throw new Error(data?.message || (r.status === 401 || r.status === 403
        ? '로그인 상태를 확인해 주세요.' : '데이터 조회 실패'));
    }
    return data;
  }

  function renderTodo(data) {
    const templates = Array.isArray(data.templates) ? data.templates : [];
    const personal = Array.isArray(data.personal) ? data.personal : [];
    const overrides = Array.isArray(data.overrides) ? data.overrides : [];
    const progress = Array.isArray(data.progress) ? data.progress : [];
    const periods = data.periods || {};
    const overrideById = new Map(overrides.map(x => [x.template_id, Number(x.target)]));
    const completed = new Map(progress.map(p => [
      [p.task_kind, p.task_id, p.period_start].join('|'), Number(p.completed_count) || 0,
    ]));
    const count = cycle => {
      const period = cycle === 'daily' ? periods.daily : periods.weekly;
      const tasks = [];
      templates.filter(t => t.is_active !== false && t.cycle === cycle).forEach(t => {
        tasks.push({ id:t.id, kind:'template', target: Number(overrideById.get(t.id) ?? t.default_target) });
      });
      personal.filter(t => t.cycle === cycle).forEach(t => {
        tasks.push({ id:t.id, kind:'personal', target:Number(t.target) });
      });
      const done = tasks.filter(t => {
        const target = Number.isFinite(t.target) && t.target > 0 ? t.target : 1;
        const current = completed.get([t.kind, t.id, period].join('|')) || 0;
        return current >= target;
      }).length;
      return { total:tasks.length, done, percent: tasks.length ? Math.round(done / tasks.length * 100) : 0 };
    };
    const day = count('daily');
    const week = count('weekly');
    todoStats.textContent = `일일 ${day.done}/${day.total} · 주간 ${week.done}/${week.total}`;
    todoMini.replaceChildren();
    for (const [caption, status] of [['오늘의 일일 숙제', day], ['이번 주 주간 숙제', week]]) {
      const wrap = node('div', 'hd-task-row');
      const head = node('div', 'hd-task-head');
      head.append(node('span', '', caption), node('strong', '', `${status.done}/${status.total} 완료`));
      const track = node('div', 'hd-track');
      const fill = node('div', 'hd-fill');
      fill.style.width = `${status.percent}%`;
      track.append(fill);
      wrap.append(head, track);
      todoMini.append(wrap);
    }
    if (day.total === 0 && week.total === 0) {
      message(todoMini, '등록된 숙제가 아직 없습니다.', 'todo.html', '숙제 등록하러 가기 ↗');
    } else {
      const link = node('a', 'hd-action', '숙제 체크리스트 열기 ↗');
      link.href = 'todo.html'; todoMini.append(link);
    }
  }

  function prepareBuffs(data) {
    const templates = Array.isArray(data.templates) ? data.templates : [];
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const customByTemplate = new Map(entries.filter(e => e.template_id).map(e => [e.template_id, e]));
    const base = templates.filter(t => t.is_active).map(t => {
      const own = customByTemplate.get(t.id);
      return { name: own?.name_override ?? t.name,
        ends_at: own?.ends_at || null,
        icon: own?.icon_override ?? t.icon_key,
      };
    });
    const personal = entries.filter(e => !e.template_id).map(e => ({
      name: e.custom_name, ends_at: e.ends_at || null, icon: e.custom_icon,
    }));
    return base.concat(personal);
  }
  function remainingLabel(ms) {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (days) return `${days}일 ${hours}시간`;
    if (hours) return `${hours}시간 ${String(minutes).padStart(2,'0')}분`;
    return `${minutes}분 ${String(secs).padStart(2,'0')}초`;
  }
  function updateBuffClock() {
    const now = Date.now();
    const running = buffItems
      .filter(b => b.ends_at && Number.isFinite(Date.parse(b.ends_at)) && Date.parse(b.ends_at) > now)
      .sort((a, b) => Date.parse(a.ends_at) - Date.parse(b.ends_at));
    buffStats.textContent = running.length ? `진행 중 ${running.length}개` : '진행 중 0개';
    buffMini.replaceChildren();
    if (!buffItems.length) {
      message(buffMini, '등록된 버프가 없습니다.', 'timer.html', '버프 타이머 열기 ↗');
      return;
    }
    if (!running.length) {
      buffMini.append(node('div', 'hd-empty', `진행 중인 버프가 없습니다. · 설정된 버프 ${buffItems.length}개`));
    } else {
      running.slice(0, 3).forEach(b => {
        const line = node('div', 'hd-buff-row');
        const left = node('span', 'hd-buff-name', b.name || '이름 없는 버프');
        const right = node('strong', 'hd-buff-time', remainingLabel(Date.parse(b.ends_at) - now));
        line.append(left, right);
        buffMini.append(line);
      });
      if (running.length > 3) buffMini.append(node('div', 'hd-empty', `그 외 ${running.length - 3}개 버프 진행 중`));
    }
    const link = node('a', 'hd-action', '버프 타이머 열기 ↗');
    link.href = 'timer.html'; buffMini.append(link);
  }
  function showLogin() {
    buffItems = [];
    todoStats.textContent = '로그인 필요';
    buffStats.textContent = '로그인 필요';
    message(todoMini, '로그인하면 내 숙제 진행률이 표시됩니다.', 'auth.html', '로그인하기 ↗');
    message(buffMini, '로그인하면 실행 중인 내 버프가 표시됩니다.', 'auth.html', '로그인하기 ↗');
  }
  async function refresh() {
    if (loading) return;
    const s = activeSession();
    if (!s) { showLogin(); return; }
    loading = true;
    const token = s.access_token;
    todoStats.textContent = '확인 중…';
    buffStats.textContent = '확인 중…';
    try {
      const results = await Promise.allSettled([
        api('blossom-todo', token), api('blossom-buffs', token),
      ]);
      // 요청 중 다른 계정으로 전환했다면 이전 계정의 데이터를 보여주지 않습니다.
      if (activeSession()?.access_token !== token) { showLogin(); return; }
      if (results[0].status === 'fulfilled') renderTodo(results[0].value);
      else {
        todoStats.textContent = '조회 실패';
        message(todoMini, '숙제 정보를 불러오지 못했습니다. 숙제 페이지 확인 후 다시 열어주세요.', 'todo.html', '숙제 페이지 ↗');
      }
      if (results[1].status === 'fulfilled') {
        buffItems = prepareBuffs(results[1].value);
        updateBuffClock();
      } else {
        buffItems = [];
        buffStats.textContent = '조회 실패';
        message(buffMini, '버프 정보를 불러오지 못했습니다. 타이머 페이지 확인 후 다시 열어주세요.', 'timer.html', '타이머 페이지 ↗');
      }
      refreshTime = Date.now();
    } finally { loading = false; }
  }
  showLogin();
  refresh();
  setInterval(() => {
    if (document.hidden) return;
    if (!activeSession()) { showLogin(); return; }
    if (Date.now() - refreshTime >= 60_000) refresh();
    else if (buffStats.textContent !== '조회 실패') updateBuffClock();
  }, 1000);
  const reload = () => { if (!document.hidden) refresh(); };
  document.addEventListener('visibilitychange', reload);
  window.addEventListener('focus', reload);
  window.addEventListener('pageshow', reload);
})();

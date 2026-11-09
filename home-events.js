/* BLOSSOM v6 — 홈 실시간 이벤트 미리보기. 승인된 회원만 일정 조회 가능. */
(() => {
  'use strict';
  const box = document.getElementById('homeEventList');
  const summary = document.getElementById('homeEventSummary');
  const state = document.getElementById('homeEventState');
  const stats = document.getElementById('homeEventStats');
  if (!box || !summary || !state || !stats) return;

  const API = 'https://hweouohzkwqhiwwsjlxu.supabase.co/functions/v1/blossom-calendar';
  const SESSION_KEY = 'blossom_test_auth_v1';
  const DAY_MS = 24 * 60 * 60 * 1000;
  const REFRESH_MS = 5 * 60 * 1000;
  const CATEGORIES = Object.freeze({
    game: '게임 이벤트', guild: '길드 일정', notice: '공지',
    maintenance: '점검', other: '기타',
  });
  let items = [];

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function getToken() {
    try {
      const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (session && session.status === 'approved' &&
          typeof session.access_token === 'string' &&
          Number(session.expires_at) > Date.now() / 1000 + 20) return session.access_token;
    } catch (_) { /* 저장된 정보가 없거나 손상된 경우 */ }
    return '';
  }
  function timeRemaining(target, now) {
    const ms = Math.max(0, target - now);
    if (ms < 60_000) return '1분 미만';
    const days = Math.floor(ms / DAY_MS);
    const hours = Math.floor((ms % DAY_MS) / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    if (days > 0) return `${days}일 ${hours}시간`;
    if (hours > 0) return `${hours}시간 ${minutes}분`;
    return `${minutes}분`;
  }
  function dateLabel(iso) {
    return new Date(iso).toLocaleDateString('ko-KR', {
      timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric',
    });
  }
  function clearAndMessage(message, loginRequired = false) {
    box.replaceChildren();
    const empty = element('div', 'home-event-empty');
    empty.append(element('span', 'home-event-empty-icon', loginRequired ? '🔐' : '🗓️'));
    empty.append(element('p', '', message));
    if (loginRequired) {
      const link = element('a', 'home-event-login', '로그인 / 회원가입 →');
      link.href = 'auth.html';
      empty.append(link);
    }
    box.append(empty);
    summary.textContent = loginRequired ? '회원 전용' : '길드 일정';
    stats.textContent = loginRequired ? '로그인 후 확인' : '일정표에서 확인';
    state.textContent = message;
  }
  function countStatus(now) {
    let active = 0, upcoming = 0;
    for (const item of items) {
      if (now >= item.start && now < item.end) active++;
      else if (now < item.start) upcoming++;
    }
    return { active, upcoming };
  }
  function updateLiveText() {
    if (!items.length) return;
    const now = Date.now();
    const { active, upcoming } = countStatus(now);
    summary.textContent = `진행 ${active} · 예정 ${upcoming}`;
    stats.textContent = `진행 ${active}건 / 예정 ${upcoming}건`;
    box.querySelectorAll('[data-event-key]').forEach(row => {
      const item = items.find(x => x.id === row.dataset.eventKey);
      if (!item) return;
      const ongoing = now >= item.start && now < item.end;
      const finished = now >= item.end;
      const badge = row.querySelector('.home-event-status');
      const remaining = row.querySelector('.home-event-remaining');
      const bar = row.querySelector('.home-event-progress-fill');
      if (badge) {
        badge.textContent = finished ? '종료' : ongoing ? '진행 중' : '예정';
        badge.className = 'home-event-status ' + (finished ? 'is-ended' : ongoing ? 'is-live' : 'is-upcoming');
      }
      if (remaining) remaining.textContent = finished ? '종료됨' : (ongoing ? '종료까지 ' : '시작까지 ') + timeRemaining(ongoing ? item.end : item.start, now);
      if (bar) bar.style.width = ongoing ? `${Math.max(2, Math.min(100, (now - item.start) / (item.end - item.start) * 100))}%` : finished ? '100%' : '0%';
    });
  }
  function render() {
    box.replaceChildren();
    const now = Date.now();
    items = items.filter(item => item.end > now);
    const ordered = [...items].sort((a, b) => {
      const aActive = a.start <= now && now < a.end;
      const bActive = b.start <= now && now < b.end;
      if (aActive !== bActive) return aActive ? -1 : 1;
      return aActive ? a.end - b.end : a.start - b.start;
    });
    if (!ordered.length) {
      clearAndMessage('현재 진행 중이거나 예정된 공개 이벤트가 없습니다.');
      return;
    }
    for (const item of ordered.slice(0, 4)) {
      const card = element('a', 'home-event-card');
      card.href = 'event.html';
      card.dataset.eventKey = item.id;
      card.setAttribute('aria-label', `${item.title}, ${dateLabel(item.start_at)}부터 ${dateLabel(item.end_at)}까지. 달력 열기`);
      const line = element('div', 'home-event-heading');
      const colorDot = element('span', 'home-event-dot');
      colorDot.style.backgroundColor = item.color;
      const title = element('span', 'home-event-name', item.title);
      const badge = element('span', 'home-event-status');
      line.append(colorDot, title, badge);
      const sub = element('div', 'home-event-meta');
      sub.append(element('span', '', `${CATEGORIES[item.category] || '이벤트'} · ${dateLabel(item.start_at)} ~ ${dateLabel(item.end_at)}`));
      sub.append(element('strong', 'home-event-remaining', ''));
      const track = element('div', 'home-event-progress');
      const fill = element('div', 'home-event-progress-fill');
      fill.style.background = `linear-gradient(90deg, ${item.color}, #ffc9f1)`;
      track.append(fill);
      card.append(line, sub, track);
      box.append(card);
    }
    state.textContent = '공개 일정 자동 연동 중';
    updateLiveText();
  }
  async function load() {
    const token = getToken();
    if (!token) {
      items = [];
      clearAndMessage('로그인 후 길드 이벤트를 확인할 수 있어요.', true);
      return;
    }
    if (!items.length) {
      state.textContent = '일정 불러오는 중…';
      summary.textContent = '불러오는 중';
    }
    const now = Date.now();
    const from = new Date(now - DAY_MS).toISOString();
    const to = new Date(now + 90 * DAY_MS).toISOString();
    try {
      const url = new URL(API);
      url.searchParams.set('from', from);
      url.searchParams.set('to', to);
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const body = await response.json().catch(() => null);
      if (response.status === 401 || response.status === 403) {
        items = [];
        clearAndMessage('로그인이 만료되었거나 회원 승인이 필요해요. 다시 로그인해 주세요.', true);
        return;
      }
      if (!response.ok || !body || body.success !== true || !Array.isArray(body.events)) {
        throw new Error('이벤트 일정 조회 실패');
      }
      // 관리자라도 숨긴 이벤트는 일반 길드원에게 보이는 홈 미리보기에서 제외.
      items = body.events.filter(event => {
        const start = Date.parse(event?.start_at);
        const end = Date.parse(event?.end_at);
        return event && event.is_visible === true &&
          typeof event.id === 'string' && typeof event.title === 'string' &&
          Number.isFinite(start) && Number.isFinite(end) && end > now &&
          typeof event.color === 'string' && /^#[\da-fA-F]{6}$/.test(event.color);
      }).map(event => ({ ...event, start: Date.parse(event.start_at), end: Date.parse(event.end_at) }));
      render();
    } catch (_) {
      items = [];
      clearAndMessage('일정을 불러오지 못했어요. 잠시 후 새로고침해 주세요.');
    }
  }

  clearAndMessage('로그인 상태 확인 중…');
  load();
  setInterval(() => {
    if (!document.hidden) {
      if (!getToken()) {
        items = [];
        clearAndMessage('로그인 후 길드 이벤트를 확인할 수 있어요.', true);
      } else {
        updateLiveText();
      }
    }
  }, 30_000);
  setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
})();

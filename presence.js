/* BLOSSOM v13 | 길드원 실시간 접속 현황
   로그인한 승인 회원만 조회 가능. 45초 하트비트, 150초 만료. */
(() => {
  'use strict';
  if (window.__blossomPresenceInitialized) return;
  window.__blossomPresenceInitialized = true;

  const API = 'https://hweouohzkwqhiwwsjlxu.supabase.co/functions/v1/blossom-presence';
  const SESSION_KEY = 'blossom_test_auth_v1';
  const INTERVAL = 45_000;
  const roleNames = {
    site_owner: '최고관리자', guild_master: '길드마스터',
    vice_master: '부마스터', staff: '운영진', member: '길드원',
  };
  const rankClass = {
    site_owner: 'owner', guild_master: 'master',
    vice_master: 'vice', staff: 'staff', member: 'member',
  };
  let inFlight = false;
  let panel = null;
  let list = null;
  let count = null;
  let status = null;
  let hideButton = null;
  let lastHidden = false;
  let lastPulseAt = 0;

  const styles = `
    .bp-presence{margin:27px 0;padding:23px 25px;border-radius:17px;
      border:1px solid #7774c3;background:linear-gradient(130deg,#25264d,#151c3c);
      box-shadow:0 9px 28px #03051566;color:#f5f3ff}
    .bp-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .bp-title{font-size:19px;font-weight:900;line-height:1.4}
    .bp-total{display:inline-flex;align-items:center;gap:7px;border:1px solid #409d93;
      background:#15494061;border-radius:999px;padding:8px 13px;color:#a6ffe5;font-weight:800;font-size:12px}
    .bp-dot{width:8px;height:8px;border-radius:50%;display:inline-block;background:#57efba;
      box-shadow:0 0 12px #57efba;animation:bp-breathe 1.8s infinite}
    @keyframes bp-breathe{50%{opacity:.4}}
    .bp-sub{color:#b9c4eb;font-size:12px;line-height:1.7;margin:9px 0 18px}
    .bp-list{display:flex;flex-wrap:wrap;gap:10px;min-height:48px;align-items:flex-start}
    .bp-user{display:flex;align-items:center;gap:10px;min-height:49px;padding:7px 13px 7px 8px;
      border-radius:12px;border:1px solid #6269ac;background:#121b39}
    .bp-user.self{border-color:#88d9ff;background:#1a3150}
    .bp-avatar{width:34px;height:34px;display:flex;align-items:center;justify-content:center;
      background:linear-gradient(130deg,#6754b8,#c676c0);color:white;border-radius:10px;font-weight:900}
    .bp-user.owner .bp-avatar{background:linear-gradient(130deg,#b27a22,#ead180);color:#271d10}
    .bp-user.master .bp-avatar{background:linear-gradient(130deg,#9a6ace,#ea95b6)}
    .bp-info{min-width:0}.bp-name{font-weight:800;font-size:13px;overflow-wrap:anywhere}
    .bp-role{font-size:10px;color:#a6b7e2;margin-top:3px}
    .bp-state{font-size:12px;color:#bdc7eb;line-height:1.6}
    .bp-foot{margin-top:19px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .bp-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .bp-controls button{font:inherit;border:1px solid #746fab;background:#21294c;
      color:#e5e8ff;border-radius:9px;padding:9px 12px;font-size:12px;font-weight:800;cursor:pointer}
    .bp-controls button:hover{border-color:#a1eaff}.bp-controls button:disabled{opacity:.5;cursor:wait}
    @media(max-width:650px){.bp-presence{padding:17px}.bp-user{flex:1 1 140px}}
  `;

  function node(tag, className = '', value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = String(value);
    return element;
  }
  function session() {
    try {
      const x = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      return x?.access_token && Number(x.expires_at) > Date.now() / 1000 + 10 ? x : null;
    } catch { return null; }
  }
  function createHomePanel() {
    const grid = document.querySelector('main .columns');
    if (!grid) return;
    const style = node('style');
    style.textContent = styles;
    document.head.append(style);

    panel = node('section', 'bp-presence');
    panel.setAttribute('aria-label', '현재 접속 중인 길드원');
    const head = node('div', 'bp-head');
    const title = node('div', 'bp-title', '🟢 현재 접속 중인 길드원');
    count = node('span', 'bp-total');
    count.append(node('span', 'bp-dot'), node('span', '', '확인 중'));
    head.append(title, count);
    panel.append(head, node('p', 'bp-sub', '지금 BLOSSOM에 접속해 있는 길드원들이에요. 약 45초마다 갱신됩니다.'));
    list = node('div', 'bp-list');
    list.setAttribute('aria-live', 'polite');
    list.append(node('div', 'bp-state', '로그인 상태 확인 중...'));
    panel.append(list);
    const foot = node('div', 'bp-foot');
    status = node('span', 'bp-state', '승인된 길드원만 서로의 접속 상태를 볼 수 있어요.');
    const controls = node('div', 'bp-controls');
    const refreshButton = node('button', '', '⟳ 새로고침');
    refreshButton.type = 'button';
    refreshButton.addEventListener('click', () => pulse(true));
    hideButton = node('button', '', '내 접속 표시 숨기기');
    hideButton.type = 'button';
    hideButton.addEventListener('click', () => setVisibility(!lastHidden));
    controls.append(refreshButton, hideButton);
    foot.append(status, controls);
    panel.append(foot);
    grid.insertAdjacentElement('afterend', panel);
  }
  function showMessage(message, failed = false) {
    if (!panel) return;
    if (list) list.replaceChildren(node('div', 'bp-state', message));
    if (status) status.textContent = failed ? '서버 연결 상태를 확인해 주세요.' : '로그인한 길드원에게만 접속 목록이 공개됩니다.';
    if (count) count.lastChild.textContent = '—';
    if (hideButton) hideButton.hidden = true;
  }
  function render(data) {
    if (!panel) return;
    const users = Array.isArray(data.users) ? data.users : [];
    count.lastChild.textContent = String(data.count ?? users.length) + '명 접속 중';
    lastHidden = Boolean(data.my_hidden);
    hideButton.hidden = false;
    hideButton.textContent = lastHidden ? '내 접속 표시 켜기' : '내 접속 표시 숨기기';
    status.textContent = lastHidden
      ? '내 닉네임은 다른 회원의 목록에서 숨겨져 있어요.'
      : '로그인한 길드원끼리만 닉네임과 등급을 확인할 수 있어요.';

    if (!users.length) {
      list.replaceChildren(node('div', 'bp-state', '현재 접속 표시를 켠 길드원이 없습니다.'));
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const user of users) {
      const role = roleNames[user.role] || '길드원';
      const box = node('div', 'bp-user ' + (rankClass[user.role] || 'member') + (user.is_me ? ' self' : ''));
      const nick = String(user.nickname || '길드원');
      const avatar = node('span', 'bp-avatar', Array.from(nick)[0] || '✿');
      const info = node('span', 'bp-info');
      info.append(node('div', 'bp-name', nick + (user.is_me ? ' (나)' : '')),
                  node('div', 'bp-role', role));
      box.append(avatar, info);
      fragment.append(box);
    }
    list.replaceChildren(fragment);
  }
  async function request(body) {
    const ss = session();
    if (!ss) {
      showMessage('로그인 후 접속 중인 길드원을 확인할 수 있어요.');
      return null;
    }
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ss.access_token },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await r.json();
    if (!r.ok || !data?.success) {
      if (r.status === 401 || r.status === 403) {
        showMessage('로그인이 만료됐거나 회원 확인이 필요해요. 다시 로그인해 주세요.');
      }
      throw new Error(data?.message || '접속 현황 조회 실패');
    }
    return data;
  }
  async function pulse(force = false) {
    if (inFlight || (!force && Date.now() - lastPulseAt < 15_000)) return;
    inFlight = true;
    try {
      const data = await request({ action: 'pulse' });
      if (data) { lastPulseAt = Date.now(); render(data); }
    } catch (err) {
      if (panel) showMessage(err?.message || '접속 현황을 불러오지 못했습니다.', true);
    } finally { inFlight = false; }
  }
  async function setVisibility(hidden) {
    if (inFlight) return;
    inFlight = true;
    if (hideButton) hideButton.disabled = true;
    try {
      const data = await request({ action: 'visibility', hidden });
      if (data) { lastPulseAt = Date.now(); render(data); }
    } catch (err) {
      if (panel) showMessage(err?.message || '표시 설정을 바꾸지 못했습니다.', true);
    } finally {
      inFlight = false;
      if (hideButton) hideButton.disabled = false;
    }
  }

  createHomePanel();
  pulse(true);
  setInterval(() => pulse(), INTERVAL);
  window.addEventListener('focus', () => pulse(), { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') pulse();
  });
  // 로그인 직후 같은 페이지에서 토큰이 만들어지는 경우에도 갱신합니다.
  window.addEventListener('blossom:authorized', () => pulse(true));
})();

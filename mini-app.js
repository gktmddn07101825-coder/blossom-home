/* BLOSSOM mini timer v11.2: own-tab login and correct status display.
   Only reads the user's buff timer data. Never interacts with the game. */
(() => {
  'use strict';
  const ROOT = 'https://hweouohzkwqhiwwsjlxu.supabase.co/functions/v1/';
  const AUTH_URL = ROOT + 'blossom-auth';
  const BUFF_URL = ROOT + 'blossom-buffs';
  const STORAGE_KEY = 'blossom_test_auth_v1';
  const $ = (id) => document.getElementById(id);
  let buffs = [];
  let fetching = false;

  function getSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
      if (s && typeof s.access_token === 'string' &&
          Number(s.expires_at) > Date.now() / 1000 + 15) return s;
    } catch (_) {}
    return null;
  }
  function message(str, error = false) {
    $('message').textContent = str;
    $('message').classList.toggle('error', !!error);
  }
  function showLogin(reason = '이 창에서 한 번 로그인하면 미니 타이머를 사용할 수 있어요.') {
    $('miniLogin').hidden = false;
    $('userName').textContent = '로그인 필요';
    $('count').textContent = '—';
    $('list').replaceChildren();
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '미니 타이머 로그인을 완료하면 실행 중인 버프가 표시됩니다.';
    $('list').append(empty);
    buffs = [];
    message(reason);
  }
  function loggedIn(session) {
    $('miniLogin').hidden = true;
    $('userName').textContent = (session.digimon_nickname || session.username || '길드원') + ' 님';
  }
  function formatSeconds(seconds) {
    const n = Math.max(0, Math.ceil(seconds));
    const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), s = n % 60;
    return (h ? `${h}:` : '') + `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  function render() {
    if (!getSession()) return;
    const active = buffs.filter((b) => b.ends_at && Date.parse(b.ends_at) > Date.now());
    $('count').textContent = `${active.length}개 진행 중`;
    const list = $('list');
    list.replaceChildren();
    if (!active.length) {
      const div = document.createElement('div');
      div.className = 'empty';
      div.textContent = '실행 중인 버프가 없어요. 버프 타이머에서 먼저 시작해 주세요.';
      list.append(div);
      return;
    }
    for (const buff of active) {
      const card = document.createElement('div');
      card.className = 'buff';
      const img = document.createElement('img');
      img.alt = '';
      img.src = {booster: 'Booster.PNG', integration: 'Integration.PNG', blessing: 'Blessing.PNG'}[buff.icon] || 'Booster.PNG';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = buff.name;
      const clock = document.createElement('span');
      clock.className = 'clock';
      clock.textContent = formatSeconds((Date.parse(buff.ends_at) - Date.now()) / 1000);
      card.append(img, name, clock);
      list.append(card);
    }
  }
  async function readJson(response) {
    try { return await response.json(); }
    catch (_) { throw new Error(`서버 응답 오류 (HTTP ${response.status})`); }
  }
  async function load() {
    const session = getSession();
    if (!session) {
      showLogin('미니 타이머는 별도 창이어서 이 창에서 로그인이 필요해요.');
      return;
    }
    loggedIn(session);
    if (fetching) return;
    fetching = true;
    try {
      const response = await fetch(BUFF_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ action: 'list' }),
        cache: 'no-store',
      });
      const data = await readJson(response);
      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem(STORAGE_KEY);
        showLogin('로그인이 만료되었거나 이용 권한이 없어요. 다시 로그인해 주세요.');
        return;
      }
      if (!response.ok || !data?.success) throw new Error(data?.message || '버프 정보를 가져오지 못했습니다.');
      const templates = Array.isArray(data.templates) ? data.templates : [];
      const entries = Array.isArray(data.entries) ? data.entries : [];
      const overrides = new Map(entries.filter((x) => x.template_id).map((x) => [x.template_id, x]));
      buffs = [];
      for (const template of templates) {
        if (template.is_active === false) continue;
        const own = overrides.get(template.id);
        buffs.push({
          name: own?.name_override || template.name,
          icon: own?.icon_override || template.icon_key,
          ends_at: own?.ends_at || null,
        });
      }
      for (const personal of entries) {
        if (personal.template_id) continue;
        buffs.push({
          name: personal.custom_name || '내 버프',
          icon: personal.custom_icon || 'booster',
          ends_at: personal.ends_at || null,
        });
      }
      render();
      message('서버와 동기화 완료! 버프 남은 시간이 표시됩니다.');
      window.BlossomSkin?.refresh?.();
    } catch (error) {
      message(error instanceof Error ? error.message : '서버 연결에 실패했습니다.', true);
    } finally {
      fetching = false;
    }
  }
  $('miniLogin').addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = $('miniUsername').value.trim().toLowerCase();
    const password = $('miniPassword').value;
    const button = $('miniLoginSubmit');
    if (!username || !password) return message('아이디와 비밀번호를 입력해 주세요.', true);
    button.disabled = true;
    message('로그인 확인 중...');
    try {
      const response = await fetch(AUTH_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username, password }), cache: 'no-store',
      });
      const data = await readJson(response);
      if (!response.ok || !data?.success || !data?.session?.access_token || data?.user?.status !== 'approved') {
        throw new Error(data?.message || '로그인에 실패했습니다.');
      }
      const s = {
        username: data.user.username || username,
        digimon_nickname: data.user.digimon_nickname || username,
        status: 'approved', role: data.user.role || 'member',
        access_token: data.session.access_token,
        expires_at: Number(data.session.expires_at) || Math.floor(Date.now() / 1000) + 3600,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      $('miniPassword').value = '';
      loggedIn(s);
      await load();
    } catch (error) {
      message(error instanceof Error ? error.message : '로그인을 완료하지 못했습니다.', true);
    } finally {
      button.disabled = false;
    }
  });
  $('refresh').addEventListener('click', () => load());
  $('miniLogout').addEventListener('click', () => {
    sessionStorage.removeItem(STORAGE_KEY);
    $('miniPassword').value = '';
    showLogin('이 미니 타이머 창에서 로그아웃했습니다.');
  });
  // Actual deadlines are stored on the server, not inferred from tab timer callbacks.
  // Re-render based on absolute end times, even after background throttling.
  load();
  setInterval(render, 1000);
  setInterval(() => { if (getSession()) load(); }, 45000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && getSession()) load();
  });
})();

/* BLOSSOM role-aware main navigation. Display-only: protected APIs verify permissions on server. */
(() => {
  'use strict';
  const SESSION_KEY = 'blossom_test_auth_v1';
  const VERIFY_URL = 'https://hweouohzkwqhiwwsjlxu.supabase.co/functions/v1/blossom-access';
  const authLink = document.getElementById('authNav');
  const adminLink = document.getElementById('adminNav');
  const logoutButton = document.getElementById('logoutNav');
  const roleTag = document.getElementById('roleTag');
  if (!authLink || !adminLink || !logoutButton || !roleTag) return;

  const roles = Object.freeze({
    site_owner: '최고관리자',
    guild_master: '길드마스터',
    vice_master: '부마스터',
    staff: '운영진',
    member: '길드원',
  });
  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
  }
  function session() {
    try {
      const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (value && typeof value.access_token === 'string' &&
          value.status === 'approved' && Number(value.expires_at) > Date.now() / 1000 + 20) return value;
    } catch (_) {}
    return null;
  }
  function anonymous() {
    authLink.textContent = '♙ 로그인 / 회원가입';
    authLink.href = 'auth.html';
    adminLink.hidden = true;
    logoutButton.hidden = true;
    roleTag.hidden = true;
  }
  function authorized(user) {
    const nickname = user.digimon_nickname || user.username || '길드원';
    authLink.textContent = '♙ ' + nickname + ' 님';
    authLink.href = 'auth.html';
    roleTag.textContent = roles[user.role] || '길드원';
    roleTag.hidden = false;
    logoutButton.hidden = false;
    adminLink.hidden = !['site_owner','guild_master','vice_master','staff'].includes(user.role);
  }
  logoutButton.addEventListener('click', () => {
    clearSession();
    anonymous();
    window.location.assign('index.html');
  });
  anonymous();
  const saved = session();
  if (!saved) return;
  authLink.textContent = '♙ 회원 확인 중...';
  (async () => {
    try {
      const response = await fetch(VERIFY_URL, {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + saved.access_token },
        cache: 'no-store',
      });
      const result = await response.json();
      if (response.status === 401 || response.status === 403) {
        clearSession();
        anonymous();
        return;
      }
      if (!response.ok || !result.success || !result.user) {
        throw new Error('회원 권한 확인 실패');
      }
      // Never infer privileges from sessionStorage; rely on the signed-in server response.
      const user = result.user;
      authorized(user);
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          ...saved,
          username: user.username || saved.username,
          digimon_nickname: user.digimon_nickname || saved.digimon_nickname,
          role: user.role || 'member',
          status: 'approved',
        }));
      } catch (_) {}
    } catch (_) {
      // Fail closed: if remote validation fails, show no privileged UI.
      anonymous();
      authLink.textContent = '♙ 로그인 / 회원 확인';
    }
  })();
})();

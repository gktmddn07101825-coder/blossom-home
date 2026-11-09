/* BLOSSOM: 회원 전용 페이지 검증. sessionStorage는 같은 탭에서 유지됩니다. */
(() => {
  'use strict';
  const SESSION_KEY = 'blossom_test_auth_v1';
  const VERIFY_URL = 'https://hweouohzkwqhiwwsjlxu.supabase.co/functions/v1/blossom-access';
  const gate = document.getElementById('blossom-access-gate');
  if (!gate) return;
  const msg = gate.querySelector('[data-gate-message]');
  const retryButton = gate.querySelector('[data-gate-retry]');
  const loginLink = gate.querySelector('[data-gate-login]');
  const currentPage = location.pathname.split('/').pop() || 'index.html';
  const allowReturn = ['todo.html', 'timer.html', 'event.html'].includes(currentPage) ? currentPage : 'index.html';
  loginLink.href = 'auth.html?next=' + encodeURIComponent(allowReturn) + '#login';
  let checking = false;

  function setText(text) { msg.textContent = text; }
  function getSession() {
    try {
      const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (value && typeof value.access_token === 'string' &&
        Number(value.expires_at) > Date.now() / 1000 + 10) return value;
    } catch (_) {}
    return null;
  }
  function clearSession() { try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {} }
  async function verify() {
    if (checking) return;
    checking = true;
    retryButton.disabled = true;
    setText('승인된 길드원인지 확인하고 있어요...');
    const session = getSession();
    if (!session) {
      setText('길드원 로그인 후 이용할 수 있는 페이지입니다.');
      retryButton.disabled = false;
      checking = false;
      return;
    }
    try {
      const response = await fetch(VERIFY_URL, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + session.access_token },
        cache: 'no-store',
      });
      let data = null;
      try { data = await response.json(); } catch (_) { throw Error('인증 서버 응답을 확인할 수 없습니다.'); }
      if (response.status === 401 || response.status === 403) {
        clearSession();
        setText(data?.message || '로그인 상태 또는 가입 승인을 확인해 주세요.');
        return;
      }
      if (!response.ok || !data?.success) {
        throw Error(data?.message || '회원 확인에 실패했습니다.');
      }
      // 프로필은 언제나 서버 결과를 기준으로 최신화합니다.
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        ...session,
        username: data.user?.username || session.username,
        digimon_nickname: data.user?.digimon_nickname || session.digimon_nickname,
        role: data.user?.role || 'member',
        status: 'approved',
      }));
      document.documentElement.dataset.blossomAccess = 'approved';
      window.dispatchEvent(new Event('blossom:authorized'));
    } catch (error) {
      setText('연결 상태를 확인해 주세요. ' + (error?.message || '잠시 후 다시 시도해 주세요.'));
    } finally {
      retryButton.disabled = false;
      checking = false;
    }
  }
  retryButton.addEventListener('click', verify);
  verify();
})();

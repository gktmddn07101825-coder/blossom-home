/* BLOSSOM v12 | 메인 홈페이지 공지사항 자동 연동
   기존 blossom-events Edge Function을 회원 인증으로 읽기 전용 호출합니다.
   event.html 게시판 / 기존 홈 이벤트·숙제·버프와 독립적으로 작동합니다. */
(() => {
  'use strict';

  const API_URL = 'https://hweouohzkwqhiwwsjlxu.supabase.co/functions/v1/blossom-events';
  const SESSION_KEY = 'blossom_test_auth_v1';
  const REFRESH_MS = 90_000;
  const MAX_ITEMS = 3;

  const panel = [...document.querySelectorAll('.columns > article.panel')]
    .find(el => el.querySelector('h2')?.textContent.includes('길드 공지사항') || el.querySelector('h2')?.textContent.includes('길드 소식'));
  if (!panel) return;panel.querySelector('h2').textContent='📢 길드 소식';
  const originalNotice = panel.querySelector('.notice');
  if (!originalNotice) return;

  const style = document.createElement('style');
  style.textContent = `
    .bn-list{display:grid;gap:10px;margin:0 0 12px}
    .bn-item{width:100%;text-align:left;display:block;cursor:pointer;color:inherit;
      background:#181f42;border:1px solid #5965a0;border-radius:12px;padding:13px 14px;
      font-family:inherit;transition:background .15s,border-color .15s}
    .bn-item:hover,.bn-item:focus-visible{background:#282958;border-color:#cc9bf6;outline:none}
    .bn-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px}
    .bn-tag{font-size:11px;color:#ffc4eb;background:#583760;border:1px solid #a272aa;
      padding:3px 7px;border-radius:999px;font-weight:800}
    .bn-latest{color:#9ef7e8;background:#163f47;border-color:#379b92}
    .bn-date{font-size:11px;color:#b4c3e7;margin-left:auto}
    .bn-title{display:block;font-size:14px;font-weight:800;line-height:1.55;color:#fff;overflow-wrap:anywhere}
    .bn-snippet{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
      overflow:hidden;font-size:12px;line-height:1.7;color:#c3cbea;margin-top:6px;overflow-wrap:anywhere}
    .bn-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:13px 0 4px}
    .bn-foot small{color:#9ab4d8;font-size:11px}
    .bn-reload{background:transparent;border:1px solid #6b70a8;border-radius:8px;
      color:#d9e9ff;padding:6px 9px;font-size:11px;cursor:pointer;font-family:inherit}
    .bn-reload:hover{border-color:#96d7fa}
    .bn-empty{background:#20264c;border:1px dashed #6970ac;padding:18px;border-radius:10px;
      color:#c6d3f3;font-size:13px;line-height:1.8}
    .bn-empty a{display:inline-block;color:#90e6ff;text-decoration:underline;margin-top:7px}
    .bn-dialog{max-width:min(680px,calc(100% - 32px));width:100%;max-height:85vh;overflow:auto;
      background:linear-gradient(145deg,#25244e,#141c39);color:#f5f3ff;
      border:1px solid #9b82e2;border-radius:18px;padding:26px;box-shadow:0 20px 75px #0009}
    .bn-dialog::backdrop{background:#020416ba;backdrop-filter:blur(4px)}
    .bn-dialog h3{font-size:21px;line-height:1.5;margin:12px 0}
    .bn-dialog .bn-body{white-space:pre-wrap;overflow-wrap:anywhere;color:#e2e5ff;
      line-height:1.85;font-size:14px;margin:18px 0 25px}
    .bn-dialog .bn-meta{color:#adbae4;font-size:12px}
    .bn-dialog-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}
    .bn-dialog-actions button,.bn-dialog-actions a{font:inherit;font-size:13px;font-weight:800;
      border:1px solid #8376ce;border-radius:9px;color:#fff;background:#454276;padding:10px 15px;cursor:pointer}
    .bn-dialog-actions a{background:linear-gradient(115deg,#6958bd,#a963cb)}
  `;
  document.head.append(style);

  function node(tag, className = '', value) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (value !== undefined) n.textContent = String(value);
    return n;
  }

  const list = node('div', 'bn-list');
  list.id = 'homeNoticeList';
  list.setAttribute('aria-live', 'polite');
  originalNotice.replaceWith(list);

  const footer = node('div', 'bn-foot');
  const status = node('small', '', '길드 소식 확인 중…');
  status.setAttribute('role', 'status');
  const reload = node('button', 'bn-reload', '↻ 공지 새로고침');
  reload.type = 'button';
  footer.append(status, reload);
  const more = panel.querySelector('a.preview');
  if (more) {
    more.textContent = '📢 공지·패치노트 전체 보기 ↗';
    more.href = 'event.html#feed';
    panel.insertBefore(footer, more);
  } else {
    panel.append(footer);
  }

  const dialog = node('dialog', 'bn-dialog');
  dialog.setAttribute('aria-label', '길드 공지사항 상세');
  const dialogTag = node('span', 'bn-tag', '📢 공지사항');
  const dialogTitle = node('h3');
  const dialogMeta = node('div', 'bn-meta');
  const dialogBody = node('div', 'bn-body');
  const actions = node('div', 'bn-dialog-actions');
  const viewBoard = node('a', '', '게시판에서 보기 ↗');
  viewBoard.href = 'event.html#feed';
  const close = node('button', '', '닫기');
  close.type = 'button';
  close.addEventListener('click', () => dialog.close());
  actions.append(viewBoard, close);
  dialog.append(dialogTag, dialogTitle, dialogMeta, dialogBody, actions);
  document.body.append(dialog);
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });

  function sessionToken() {
    try {
      const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (session && session.status === 'approved' &&
          typeof session.access_token === 'string' &&
          Number(session.expires_at) > Date.now() / 1000 + 20) return session.access_token;
    } catch (_) { /* 세션 없음 */ }
    return '';
  }

  function dateLabel(value) {
    const date = new Date(value || '');
    if (!Number.isFinite(date.getTime())) return '';
    return date.toLocaleDateString('ko-KR', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    });
  }

  function empty(message, loginRequired = false) {
    list.replaceChildren();
    const box = node('div', 'bn-empty', message);
    if (loginRequired) {
      box.append(node('br'));
      const a = node('a', '', '로그인하고 공지 확인하기 ↗');
      a.href = 'auth.html?next=index.html#login';
      box.append(a);
    }
    list.append(box);
  }

  function openNotice(post) {
    dialogTag.textContent=post.is_pinned?'📌 고정':post.kind==='patchnote'?'🛠 패치노트':'📢 공지사항';dialogTitle.textContent = post.title || '제목 없는 글';
    dialogMeta.textContent = [post.author_name ? `작성자 ${post.author_name}` : '', dateLabel(post.created_at)]
      .filter(Boolean).join(' · ');
    dialogBody.textContent = post.content || '내용이 없습니다.';
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else window.location.assign('event.html#feed');
  }

  function render(posts) {
    list.replaceChildren();
    const notices = posts
      .filter(p => p && (p.kind === 'notice' || p.kind === 'patchnote'))
      .sort((a,b)=>Number(!!b.is_pinned)-Number(!!a.is_pinned)||(Date.parse(b.pinned_at||b.created_at)||0)-(Date.parse(a.pinned_at||a.created_at)||0));
    status.textContent = `공지·패치노트 ${notices.length}건 · ${Math.min(MAX_ITEMS,notices.length)}건 표시`;
    if (!notices.length) {
      empty('아직 등록된 공지사항이나 패치노트가 없습니다.');
      return;
    }
    notices.slice(0, MAX_ITEMS).forEach((post, i) => {
      const card = node('button', 'bn-item');
      card.type = 'button';
      const top = node('div', 'bn-top');
      top.append(node('span', 'bn-tag' + (i === 0 ? ' bn-latest' : ''), post.is_pinned ? '📌 고정' : post.kind === 'patchnote' ? '🛠 패치노트' : '📢 공지'));
      top.append(node('span', 'bn-date', dateLabel(post.created_at)));
      const title = node('strong', 'bn-title', post.title || '제목 없는 공지');
      const snippet = node('div', 'bn-snippet', (post.content || '').replace(/\s+/g, ' ').trim());
      card.append(top, title, snippet);
      card.addEventListener('click', () => openNotice(post));
      list.append(card);
    });
  }

  let busy = false;
  let lastLoaded = 0;
  async function loadNotices() {
    if (busy) return;
    const token = sessionToken();
    if (!token) {
      empty('길드 공지사항은 로그인한 길드원에게 표시됩니다.', true);
      status.textContent = '로그인 후 확인';
      return;
    }
    busy = true;
    reload.disabled = true;
    status.textContent = '공지 업데이트 확인 중…';
    try {
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success !== true || !Array.isArray(data.posts)) {
        throw new Error(data?.message || `게시판 조회에 실패했습니다 (${response.status}).`);
      }
      render(data.posts);
      lastLoaded = Date.now();
    } catch (error) {
      status.textContent = '공지 불러오기 실패';
      empty(error?.message || '일시적인 오류가 발생했습니다. 새로고침해 주세요.');
    } finally {
      busy = false;
      reload.disabled = false;
    }
  }

  reload.addEventListener('click', loadNotices);
  window.addEventListener('focus', () => {
    if (Date.now() - lastLoaded > 30_000) loadNotices();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastLoaded > 30_000) loadNotices();
  });
  setInterval(() => { if (!document.hidden) loadNotices(); }, REFRESH_MS);
  loadNotices();
})();

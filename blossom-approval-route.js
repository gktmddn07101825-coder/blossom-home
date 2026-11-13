/* BLOSSOM v18.4 — route legacy admin approval actions to v17 community approvals.
   Read-only navigation only. Never modifies sessions, permissions, or memberships. */
(() => {
  'use strict';
  if (window.__BLOSSOM_APPROVAL_ROUTE_V184__) return;
  window.__BLOSSOM_APPROVAL_ROUTE_V184__ = true;
  const APPROVAL_PAGE = 'public-hub.html?tab=applications';

  function mountNotice() {
    if (document.getElementById('blossomApprovalRouteNotice')) return;
    const main = document.querySelector('main');
    if (!main) return;
    const box = document.createElement('section');
    box.id = 'blossomApprovalRouteNotice';
    box.setAttribute('aria-label', '새 가입 승인 안내');
    box.style.cssText = 'margin:16px auto 22px;max-width:1050px;padding:18px 20px;border-radius:13px;border:1px solid #72c8e8;background:#102940;color:#edf9ff;font:14px/1.65 system-ui,sans-serif;box-sizing:border-box';
    const title = document.createElement('strong');
    title.textContent = '🗂 가입 승인은 새 커뮤니티에서 진행해 주세요';
    title.style.cssText = 'display:block;font-size:17px;margin-bottom:5px';
    const description = document.createElement('p');
    description.textContent = '기존 관리자 페이지의 가입 승인 API는 새 시스템에서 사용 중지되었습니다. 이곳의 회원 관리·등급 관리 기능은 유지되며, 가입 승인만 새 화면으로 연결됩니다.';
    description.style.cssText = 'margin:0 0 12px;color:#c7e2ec';
    const link = document.createElement('a');
    link.href = APPROVAL_PAGE;
    link.textContent = '가입 승인 화면 열기 →';
    link.style.cssText = 'display:inline-block;background:#8bdaf2;color:#102638;padding:10px 15px;border-radius:8px;font-weight:800;text-decoration:none';
    box.append(title, description, link);
    main.insertBefore(box, main.firstChild);
  }

  // Catch-phase interception prevents obsolete inline click handlers from
  // calling blossom-admin's retired action=review endpoint (403).
  document.addEventListener('click', event => {
    const button = event.target.closest?.('button');
    if (!button) return;
    const oldPendingTab = button.id === 'pendingTab';
    const oldReviewButton = Boolean(
      button.closest('#pendingList') ||
      (button.closest('#members') && /(?:^|\s)(?:승인|거절)\s*$/.test(button.textContent || ''))
    );
    if (!oldPendingTab && !oldReviewButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign(APPROVAL_PAGE);
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountNotice, {once:true});
  } else {
    mountNotice();
  }
})();

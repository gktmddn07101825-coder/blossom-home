BLOSSOM mini timer v11.2 오류 수정 — blossom-test만!

문제:
1. 이전 mini-app.js에는 '회원 확인 중...' 상태를 완료된 닉네임으로 바꾸는 코드가 없었습니다.
2. 기존 로그인은 sessionStorage(탭별 저장)라 새 미니 창에서 로그인 정보가 없을 수 있습니다.

적용: GitHub blossom-test 저장소 최상위 파일 중
 - mini.html 기존 파일 교체
 - mini-app.js 기존 파일 교체
위 두 파일만 GitHub에서 업로드 → Commit changes.
Supabase SQL, Edge Functions, 버프 데이터, 기타 HTML 파일은 수정하지 않습니다.

테스트:
1) https://gktmddn07101825-coder.github.io/blossom-test/mini.html?v=11-2
2) '미니 타이머 로그인'이 보이면 기존 길드 계정으로 이 창에서 한 번 로그인.
3) 닉네임과 실행 중인 버프가 표시되어야 합니다.
4) 버프를 timer.html에서 먼저 시작해야 남은 시간이 나옵니다.
5) 새로고침해도 동일한 탭에서는 로그인과 남은 시간이 이어집니다.

주의: 이 페이지는 게임 키 입력을 감지하지 않으며 게임을 조작하지 않습니다.
설정/종료 시각은 서버에서 그대로 불러옵니다.
별도 창에서 브라우저가 종료되면 브라우저 세션이 끝날 수 있으므로 다시 로그인해야 할 수 있습니다.

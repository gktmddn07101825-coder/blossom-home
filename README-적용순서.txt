BLOSSOM 숙제 체크리스트 v7 — 적용 안내
========================================

적용 대상: GitHub blossom-test 테스트 저장소만. blossom-home(운영) 수정 금지.
기존 이벤트·관리자·회원가입 파일을 수정할 필요 없습니다.

[1] Supabase SQL Editor → New query
    ZIP/sql/01-todo.sql 전체 복사 → Run
    기대 메시지: Success. No rows returned

[2] Supabase Edge Functions → Create function
    함수 이름: blossom-todo
    ZIP/supabase/blossom-todo-index.ts 전체 복사 → index.ts에 붙여넣기 → Deploy
    설정: Verify JWT with legacy secret = OFF
    (함수 내부에서 실제 사용자 JWT와 승인 상태를 확인합니다.)
    기존 blossom-auth, blossom-access, blossom-admin, blossom-events,
    blossom-calendar 함수는 건드리지 않습니다.

[3] GitHub 저장소 gktmddn07101825-coder/blossom-test
    ZIP/todo.html → 기존 todo.html과 교체
    ZIP/todo-app.js → index.html과 같은 위치에 새로 업로드
    Commit changes
    기존 member-gate.js는 그대로 유지(필수 파일)

[4] 테스트 주소:
    https://gktmddn07101825-coder.github.io/blossom-test/todo.html?v=7

[5] 기능 확인 순서
    ① 운영진 이상으로 로그인해 todo.html 접속
    ② 페이지 하단 "길드 기본 숙제 관리"에서 기본 숙제 등록
       예: 일일 / 스파이럴 퀘스트 / 기본 1회
    ③ 일반 회원으로 로그인 → 길드 기본 숙제 표시 확인
       일반 회원은 기본 숙제 제목·분류를 수정할 수 없고 횟수만 선택 가능
    ④ 일반 회원 "내 숙제 추가"로 개인 숙제 생성
       일일/주간, 1~20회 선택, 수정·삭제 가능
    ⑤ +/- 버튼으로 횟수 기록, 완료 체크박스로 한 번에 완료/해제
    ⑥ 페이지 새로고침 및 로그아웃→재로그인해 설정/체크 상태 보존 확인

초기화 규칙 (모두 한국 표준시 Asia/Seoul):
  - 일일: 매일 00:00
  - 주간: 매주 화요일 00:00
  - 날짜 기간의 완료 기록만 새로 시작됩니다.
  - 길드 기본 숙제/개인 숙제/개인별 목표 횟수는 초기화되지 않습니다.
  - 서버에서 현재 기간으로 구분하여 조회하므로 정기 크론 작업 불필요.
  - 일일/주간 진행 기록은 데이터베이스에 기간별로 저장됩니다.

중요:
  - 이 버전은 서버에 저장하므로 브라우저를 닫거나 HTML을 업데이트해도
    같은 아이디로 로그인하면 목록/개인 목표/진행 기록이 돌아옵니다.
  - 현재 로그인 세션은 브라우저 sessionStorage를 사용합니다. 탭을
    완전히 닫으면 재로그인이 필요할 수 있으나 숙제 데이터는 유지됩니다.
  - 저장 중에는 탭을 닫지 마세요. 저장 완료 메시지 후 종료하는 것이 안전합니다.
  - SQL을 적용하기 전에 GitHub 파일만 올리면 목록 조회가 실패합니다.
  - 이 단계는 기존 운영 홈페이지에 적용하지 마세요.

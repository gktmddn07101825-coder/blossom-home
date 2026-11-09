BLOSSOM 버프 타이머 v8 — blossom-test 전용

기존 로그인·숙제·이벤트·관리자 기능을 변경하지 않습니다.
사용자가 올린 아이콘 3개, 알림음 3개를 실제 파일로 동봉했습니다.

[1] Supabase: SQL 만들기
Supabase > SQL Editor > New query
압축 파일 안의 sql/01-buffs.sql 전체 복사 > Run
기존 테이블을 변경하지 않고 버프 전용 테이블 2개를 새로 만듭니다.

[2] Supabase: Edge Function 만들기
Supabase > Edge Functions > Create function
함수 이름 정확히: blossom-buffs
index.ts 내용을 supabase/blossom-buffs-index.ts 내용으로 전체 교체 후 Deploy
Settings: Verify JWT with legacy secret = OFF
(기존 blossom-auth, blossom-admin, blossom-todo 등의 함수는 수정하지 않습니다.)

[3] GitHub: 오직 blossom-test에만 업로드
GitHub > gktmddn07101825-coder/blossom-test
다음 8개 파일을 index.html과 같은 최상위 위치에 놓습니다.

교체 파일 (1개): timer.html
새로 올릴 파일 (7개):
  buff-app.js
  Booster.PNG
  Integration.PNG
  Blessing.PNG
  digivice.wav
  digivice-alert.mp3
  alert.mp3

파일 이름의 대소문자를 그대로 유지해 주세요.
폴더에 있는 SQL/.ts 파일은 GitHub에 올리지 마세요.
기존 member-gate.js가 저장소에 있어야 하며, 이전 숙제 페이지에서 사용 중이었다면 이미 있습니다.
Commit changes > GitHub Pages 배포 완료 후 접속.

테스트 주소:
https://gktmddn07101825-coder.github.io/blossom-test/timer.html?v=8

[4] 실제 테스트
① 최고관리자 로그인 > 타이머 페이지 맨 아래 '길드 기본 버프 관리'에서 3개 등록
② 일반회원 로그인 > 기본 버프 표시 확인
③ 일반회원에서 버프 시간/이름/아이콘/알림음/볼륨 변경 > '설정 저장'
④ 새로고침 > 변경 내용 유지 확인
⑤ '내 버프 추가' > 새로고침 후 유지 확인
⑥ 버프 시간 1분으로 설정 > '시작/재시작' > 종료 알림음 재생 확인
⑦ 다른 계정 로그인 > 첫 회원의 개인 설정/개인 버프가 보이지 않는지 확인

소리 3종:
① 디지바이스 효과음: digivice.wav
② 디지바이스 알림: digivice-alert.mp3 (원본: 디지바이스 알림음.mp3)
③ 음성 알림: alert.mp3

주의:
- 길드 공용 기본 버프는 운영진 이상만 관리할 수 있습니다.
- 일반 회원도 자기 기본 버프의 이름/시간/알림음/볼륨/아이콘을 개인별로 바꾸고 저장할 수 있습니다.
- 다른 회원의 개인 설정에 영향을 주지 않습니다.
- 사용자 설정/실행 종료시각은 Supabase에 저장되어 브라우저를 닫아도 복구됩니다. 재로그인은 필요할 수 있습니다.
- 브라우저가 완전히 닫혔을 때 서버가 자동으로 소리를 재생해 주지는 않습니다. 페이지를 연 상태에서만 알림음 재생을 시도합니다.
- 타이머 실행 중 설정을 바꾸면 다음 시작부터 변경한 시간으로 적용되며, 실행 중인 종료 시각은 그대로 유지됩니다.
- 운영진의 기본 버프 완전 삭제 시 해당 버프의 모든 개인 설정도 삭제되므로 신중히 선택하세요. 일반 회원은 기본 버프를 삭제할 수 없습니다.

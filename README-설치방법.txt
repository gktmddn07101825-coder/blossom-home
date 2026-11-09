BLOSSOM 포인트 상점 v11.1 - 빠른 적용

1. 이 ZIP 압축 해제
2. GitHub > gktmddn07101825-coder/blossom-test > main
3. shop.html / shop-app.js 두 파일만 기존 파일과 교체
4. Commit changes
5. https://gktmddn07101825-coder.github.io/blossom-test/shop.html?v=11-1 확인

핵심 변화
- 카테고리 6개(전체/테마/닉네임/칭호/미니 타이머/체크리스트) 상단 큰 버튼으로 표시
- 이름·설명 검색, 검색 초기화, 가격순/구매가능 정렬, 보관함 카테고리 필터
- 최고관리자 전용 BP 지급/차감 선택 버튼 및 권한 안내

중요
- v11 SQL 및 blossom-rewards Edge Function을 이미 설치했다면 다시 실행하거나 배포할 필요 없습니다.
- 최고관리자(site_owner) 외에 BP 지급/차감 불가: v11 Edge Function이 사용자의 실제 Supabase 프로필 역할을 재확인하고, SQL RPC는 service_role에만 권한이 있습니다.
- 다른 회원 권한은 관리자 회원 관리 기능과 구분됩니다.
- BP 차감은 잔액보다 많이 할 수 없습니다. 한 번에 최대 2,000 BP입니다.
- 기존 포인트, 출석 내역, 보관함, 구매 기록과 다른 HTML 파일은 건드리지 않습니다.

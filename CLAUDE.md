# GoodsFactory Project

## Overview
B2B+B2C+C2B 굿즈 제조 및 판매 플랫폼 (대학교 캡스톤 프로젝트)
- 소비자/기업이 커스텀 굿즈 제조 의뢰 → 제조사(공장/개인)가 입찰
- 공동구매로 수요 집계, 마켓플레이스(리뷰/프로모션) 포함

**Deadline:** 2026-06-15

## Tech Stack
- Frontend: Vanilla JS, HTML/CSS
- Backend: Supabase (PostgreSQL + Auth + Storage)
- Deployment: GitHub Pages
- URL: https://seaottersandpikas.github.io/2026Spring/
- Test account: `test@test.com` / `test123456`

## File Structure
- `index.html` — 메인 진입점
- `assets/js/app.js` — 앱 전체 초기화 및 라우팅
- `assets/js/requests.js` — 의뢰 생성/조회/상태 전환
- `assets/js/bids.js` — 입찰 제출/조회
- `assets/js/notifications.js` — 알림 시스템
- `assets/js/reviews.js` — 리뷰/평판 시스템
- `assets/js/auth.js` — 인증/세션 관리
- `assets/js/supabase-client.js` — Supabase 클라이언트 초기화
- `assets/css/` — 전체 스타일
- `migrations/` — Supabase SQL 마이그레이션 파일
- `DEMO_SCRIPT.md` — 시연 시나리오 스크립트

## Implementation Status

### Completed
- **Phase 0** — UI 구조 개편: 프로필 메뉴, 의뢰 타입 탭(대량생산/개인), 제조사 입찰 카드, 마켓플레이스 탭
- **Phase 1** — 실제 입찰 시스템: `submitBidModal`, Supabase `bids` 테이블, 제조사 프로필 DB 저장
- **Phase 2** — 공동구매 참여(`joinGroupModal`, `group_participants`), 실제 포스트 시스템(`posts` 테이블)
- **Phase 3** — 알림 시스템(`notifications.js`), 벨 버튼+미읽음 뱃지, 디자인 파일 업로드(`request_files`)
- **Phase 4** — 거래 완결: 입찰→매칭→생산→배송→완료→정산 전체 플로우
  - `requests` 테이블 컬럼 추가: `payment_status`, `paid_at`, `tracking_number`, `shipped_at`, `completed_at`, `payment_amount`, `payment_method`, `matched_bid_id`
  - `requests.js` 함수: `confirmMatch`, `startProduction`, `markShipped`, `confirmDelivery`, `autoCompleteOverdueShipping`(7일 자동완료), `getPaymentHistory`
  - Migration: `migrations/phase4_transaction_closure.sql`
- **Phase 7** — 신뢰/평판 시스템: `reviews.js`, 별점 1–5, 거래 완료 후 자동 리뷰 모달, 중복 방지
  - `profiles` 테이블: `avg_rating`, `total_reviews`, `completed_count` 캐시 집계
  - Migration: `migrations/phase7_trust_reputation.sql`
- **Phase 9** — RLS 정책 수정: 매칭된 생산자에게 requests UPDATE 권한 부여
  - Migration: `migrations/phase9_rls_policies.sql`
- **Phase 10** — 역할 분리 + 후기/홍보 개선 (2026-06-09)
  - 역할 기반 내비 제한: 생산자/소비자 탭 교차 진입 차단, `navigateAsRole()` / `applyRoleBasedUI()`
  - 비로그인 홈 role-card → 로그인 모달 (역할 힌트), 로그인 후 해당 역할 페이지 자동 이동
  - 마켓플레이스 후기: `reviewSelectModal` (완료/취소 건 분리), `writeCancelReviewModal` (취소사유+후기+이미지)
  - 후기 카드 썸네일 + `postDetailModal` 상세 팝업
  - 생산자 홍보글: 다중 이미지 업로드(Storage `post-images`), 이미지 슬라이더, 카드 레이아웃 개선
  - Migration: `migrations/phase10_role_separation.sql`
- **Phase 11** — 계정/로그인 개선, 마켓플레이스 개선, 영수증, 직접 의뢰 (2026-06-09~11)
  - 로그인 버그 수정: Safari bfcache, VPN 환경 타임아웃, refresh_token 루프, `INITIAL_SESSION`/`SIGNED_IN` 이벤트 분리
  - 직접의뢰 배지: 의뢰 카드 및 생산자 입찰 카드에 ⚡ 직접의뢰 인덱스 표시
  - 영수증 버튼 위치 개선
  - 생산자 홍보 탭: "내가 등록한" / "다른 생산자 홍보" 섹션 구분
  - 모바일 반응형: 480px 이하 iPhone/Galaxy 전용 CSS
  - 비로그인 마켓플레이스 버튼 제한: 공동제작 의뢰작성/후기작성/홍보등록 숨김 + 로그인 팝업
  - 생산자 공동제작 탭: 모집 중만 표시, 의뢰작성/내가등록/내가참여 탭 숨김
  - 홈 페이지 리디자인 (billowy 디자인 시스템)
  - 시연 더미 데이터 시딩 (`migrations/seed_demo_data.sql`, `phase11_seed_additional.sql`)
  - Migration: `migrations/phase11_fixes.sql`, `migrations/phase11_group_rls.sql`

### Remaining
- **Phase 5** — 검색/필터 개선
- **Phase 6** — 관리자 대시보드

## Key Decisions
- 결제는 시뮬레이션 (실제 PG 미연동, 데모용)
- 7일 경과 미확인 배송은 자동 완료 처리
- 모든 테이블에 Supabase Row Level Security 정책 적용
- JS 모듈 분리 아키텍처: `bids.js`, `notifications.js`, `reviews.js`, `requests.js`, `auth.js`
- 브랜드명: billowy (이전 foaming에서 변경)
- 테스트 계정: `test@test.com` → 생산자(manufacturer), `test2@test.com` → 소비자(별도 가입 필요)

## Known Issues / Watch Out
- 초기 코드에 XSS 취약점 있었음 (`innerHTML`에 사용자 입력 직접 삽입) — Phase 0에서 수정
- API 키 하드코딩 이력 있음 — 환경변수 또는 Supabase anon key 정책으로 관리
- Safari bfcache + VPN 환경에서 로그인 세션 불안정 이슈 — Phase 11에서 수정
- `phase10_role_separation.sql` 미실행 시 이미지/역할 기능 작동 안 함

## Session History
| Session ID | Date | 내용 |
|------------|------|------|
| `646a9471` | 2026-05-15~19 | Phase 0~3 구현, 컨텍스트 소진으로 종료 |
| `718ae7d2` | 2026-05-19~28 | Phase 4+7 구현, E2E 테스트 중 중단 |
| `b28bc8a8` | 2026-06-09 | Phase 9+10+11 구현: 역할분리, 후기/홍보 개선, 로그인 버그 수정, 모바일 반응형, 직접의뢰 |

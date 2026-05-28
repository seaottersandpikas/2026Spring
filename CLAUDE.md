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
- `app.js` — 앱 전체 초기화 및 라우팅
- `requests.js` — 의뢰 생성/조회/상태 전환
- `bids.js` — 입찰 제출/조회
- `notifications.js` — 알림 시스템
- `reviews.js` — 리뷰/평판 시스템
- `style.css` — 전체 스타일
- `migrations/` — Supabase SQL 마이그레이션 파일

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

### Remaining
- **Phase 5** — 검색/필터 개선
- **Phase 6** — 관리자 대시보드
- E2E 통합 테스트 + 데모용 더미 데이터 시딩

## Key Decisions
- 결제는 시뮬레이션 (실제 PG 미연동, 데모용)
- 7일 경과 미확인 배송은 자동 완료 처리
- 모든 테이블에 Supabase Row Level Security 정책 적용
- JS 모듈 분리 아키텍처: `bids.js`, `notifications.js`, `reviews.js`, `requests.js`

## Known Issues / Watch Out
- 초기 코드에 XSS 취약점 있었음 (`innerHTML`에 사용자 입력 직접 삽입) — Phase 0에서 수정
- API 키 하드코딩 이력 있음 — 환경변수 또는 Supabase anon key 정책으로 관리

## Session History
| Session ID | Date | 내용 |
|------------|------|------|
| `646a9471` | 2026-05-15~19 | Phase 0~3 구현, 컨텍스트 소진으로 종료 |
| `718ae7d2` | 2026-05-19~28 | Phase 4+7 구현, E2E 테스트 중 중단 |

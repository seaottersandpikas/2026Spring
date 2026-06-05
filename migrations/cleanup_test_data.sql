-- =====================================================
-- 테스트 데이터 정리 SQL
-- E2E 자동화 반복 실행으로 쌓인 더미 데이터 삭제
-- =====================================================
-- Supabase SQL Editor에서 실행하세요.
-- 실행 전 반드시 아래 '확인 쿼리'로 삭제 대상을 검토하세요.
-- =====================================================

-- ── 1. 삭제 대상 미리 확인 ───────────────────────────
-- 아래 쿼리로 삭제될 건수를 먼저 확인하세요.

SELECT
  (SELECT COUNT(*) FROM requests WHERE title LIKE '[E2E-%') AS e2e_requests,
  (SELECT COUNT(*) FROM requests WHERE title LIKE 'E2E 테스트%') AS e2e_test_requests,
  (SELECT COUNT(*) FROM bids    WHERE note  LIKE 'E2E 자동%')    AS e2e_bids,
  (SELECT COUNT(*) FROM posts   WHERE content LIKE 'E2E 자동%')  AS e2e_posts;


-- ── 2. 정리 실행 ─────────────────────────────────────
-- 순서대로 하나씩 실행하세요 (외래키 순서 중요)

-- 2-1) 관련 후기 삭제
DELETE FROM posts
WHERE request_id IN (
  SELECT id FROM requests
  WHERE title LIKE '[E2E-%' OR title LIKE 'E2E 테스트%'
)
OR content LIKE 'E2E 자동%';

-- 2-2) 관련 match_history 삭제
DELETE FROM match_history
WHERE request_id IN (
  SELECT id FROM requests
  WHERE title LIKE '[E2E-%' OR title LIKE 'E2E 테스트%'
);

-- 2-3) 관련 request_files 삭제
DELETE FROM request_files
WHERE request_id IN (
  SELECT id FROM requests
  WHERE title LIKE '[E2E-%' OR title LIKE 'E2E 테스트%'
);

-- 2-4) 관련 입찰 삭제
DELETE FROM bids
WHERE request_id IN (
  SELECT id FROM requests
  WHERE title LIKE '[E2E-%' OR title LIKE 'E2E 테스트%'
)
OR note LIKE 'E2E 자동%';

-- 2-5) 관련 알림 삭제
DELETE FROM notifications
WHERE related_id IN (
  SELECT id FROM requests
  WHERE title LIKE '[E2E-%' OR title LIKE 'E2E 테스트%'
);

-- 2-6) 의뢰 삭제
DELETE FROM requests
WHERE title LIKE '[E2E-%' OR title LIKE 'E2E 테스트%';


-- ── 3. 정리 후 잔여 데이터 확인 ─────────────────────
SELECT
  (SELECT COUNT(*) FROM requests)               AS total_requests,
  (SELECT COUNT(*) FROM requests WHERE title LIKE '[E2E-%' OR title LIKE 'E2E 테스트%') AS remaining_e2e,
  (SELECT COUNT(*) FROM bids)                   AS total_bids,
  (SELECT COUNT(*) FROM posts WHERE post_type='review') AS total_reviews,
  (SELECT COUNT(*) FROM match_history)          AS total_match_history;

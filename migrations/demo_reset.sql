-- =====================================================
-- demo_reset.sql — 시연 전 DB 초기화
-- 6/15 발표 전 Supabase SQL Editor에서 실행하세요.
-- =====================================================
-- 시연 계정(test2, test4)의 최근 7일 의뢰/입찰/알림 정리
-- 기존 시드 데이터(씩씩한 더미 후기/홍보글)는 유지됩니다.
-- =====================================================

DO $$
DECLARE
  test2_id uuid;
  test4_id uuid;
  test_id  uuid;
  test3_id uuid;
BEGIN
  SELECT id INTO test2_id FROM profiles WHERE email = 'test2@test.com';
  SELECT id INTO test4_id FROM profiles WHERE email = 'test4@test.com';
  SELECT id INTO test_id  FROM profiles WHERE email = 'test@test.com';
  SELECT id INTO test3_id FROM profiles WHERE email = 'test3@test.com';

  -- 1. 알림 삭제 (시연 계정 관련 — user_id 기준으로만 정리)
  DELETE FROM notifications
  WHERE user_id IN (test2_id, test4_id, test_id, test3_id)
    AND created_at > now() - interval '7 days';

  -- 2. 최근 후기/홍보 삭제 (시연용 작성분)
  DELETE FROM posts
  WHERE user_id IN (test2_id, test4_id, test_id, test3_id)
    AND created_at > now() - interval '7 days';

  -- 3. match_history 삭제
  DELETE FROM match_history
  WHERE request_id IN (
    SELECT id FROM requests
    WHERE user_id IN (test2_id, test4_id)
      AND created_at > now() - interval '7 days'
  );

  -- 4. group_participants 삭제
  DELETE FROM group_participants
  WHERE request_id IN (
    SELECT id FROM requests
    WHERE user_id IN (test2_id, test4_id)
      AND created_at > now() - interval '7 days'
  )
  OR user_id IN (test2_id, test4_id);

  -- 5. 입찰 삭제
  DELETE FROM bids
  WHERE request_id IN (
    SELECT id FROM requests
    WHERE user_id IN (test2_id, test4_id)
      AND created_at > now() - interval '7 days'
  );
  -- 생산자가 등록한 입찰도 정리
  DELETE FROM bids
  WHERE manufacturer_id IN (test_id, test3_id)
    AND created_at > now() - interval '7 days';

  -- 6. 의뢰 삭제 (최근 7일)
  DELETE FROM requests
  WHERE user_id IN (test2_id, test4_id)
    AND created_at > now() - interval '7 days';

  RAISE NOTICE '✅ 시연 DB 초기화 완료';
  RAISE NOTICE 'test2: %, test4: %, test: %, test3: %', test2_id, test4_id, test_id, test3_id;
END $$;

-- 확인
SELECT
  (SELECT COUNT(*) FROM requests WHERE created_at > now() - interval '7 days') AS recent_requests,
  (SELECT COUNT(*) FROM bids WHERE created_at > now() - interval '7 days')     AS recent_bids,
  (SELECT COUNT(*) FROM notifications WHERE created_at > now() - interval '7 days') AS recent_notifs;

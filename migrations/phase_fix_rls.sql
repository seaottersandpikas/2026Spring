-- =====================================================
-- phase_fix_rls.sql
-- 직접의뢰 bids INSERT + 생산자 제작시작 UPDATE RLS 수정
-- Supabase SQL Editor에서 실행하세요.
-- =====================================================

-- ── 1. bids INSERT 정책: 의뢰자가 직접의뢰용 bid를 삽입 가능하도록 허용 ──
-- 기존: bids_insert_own — auth.uid() = manufacturer_id (생산자 본인만)
-- 추가: bids_insert_by_requester — 의뢰 소유자가 직접의뢰 bid를 삽입 허용

DROP POLICY IF EXISTS "bids_insert_by_requester" ON bids;
CREATE POLICY "bids_insert_by_requester" ON bids
  FOR INSERT WITH CHECK (
    -- 의뢰 소유자가 직접의뢰 bid를 삽입하는 경우
    auth.uid() = (
      SELECT user_id FROM requests WHERE id = bids.request_id
    )
  );

-- ── 2. requests UPDATE: 정책이 없거나 잘못 적용된 경우 재생성 ──
-- 기존 정책을 DROP하고 재생성 (중복 방지)
DROP POLICY IF EXISTS "requests_update_participant" ON requests;

CREATE POLICY "requests_update_participant" ON requests
  FOR UPDATE USING (
    -- 의뢰자 본인
    auth.uid() = user_id
    OR
    -- 매칭된 생산자 (matched_bid_id로 연결된 입찰의 제조사)
    auth.uid() = (
      SELECT b.manufacturer_id
      FROM bids b
      WHERE b.id = requests.matched_bid_id
      LIMIT 1
    )
  );

-- ── 3. bids SELECT: 생산자가 자신의 의뢰(매칭된 것) requests 조회 가능 확인 ──
-- requests SELECT는 이미 USING(true)이므로 추가 불필요

-- ── 4. 확인 쿼리 ──
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('requests', 'bids')
ORDER BY tablename, policyname;

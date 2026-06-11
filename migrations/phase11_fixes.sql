-- =====================================================
-- Phase 11-3: group_participants created_at 추가
--             + match_history FK ON DELETE SET NULL
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

-- ① group_participants에 created_at 컬럼 추가
ALTER TABLE group_participants
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ② match_history의 request_id FK를 ON DELETE CASCADE로 변경
--    (의뢰 삭제 시 match_history도 함께 삭제)
ALTER TABLE match_history
  DROP CONSTRAINT IF EXISTS match_history_request_id_fkey;

ALTER TABLE match_history
  ADD CONSTRAINT match_history_request_id_fkey
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE;

-- ③ match_history의 bid_id FK도 CASCADE로 변경
ALTER TABLE match_history
  DROP CONSTRAINT IF EXISTS match_history_bid_id_fkey;

ALTER TABLE match_history
  ADD CONSTRAINT match_history_bid_id_fkey
  FOREIGN KEY (bid_id) REFERENCES bids(id) ON DELETE CASCADE;

-- ④ bids의 request_id FK CASCADE 확인 (이미 돼 있을 수 있음)
-- (bids 삭제 시 match_history도 삭제되도록)

-- 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'group_participants' AND column_name = 'created_at';

-- =====================================================
-- Phase 7 Fix: PostgREST join을 위한 외래키 제약 추가
-- 오류: PGRST200 "no foreign key relationship found"
-- 원인: bids/posts 테이블에 profiles/requests 향한 FK 없음
-- =====================================================
-- PostgreSQL은 ADD CONSTRAINT IF NOT EXISTS 미지원
-- → DO $$로 중복 실행 안전하게 처리
-- =====================================================

DO $$
BEGIN

  -- 1) bids.manufacturer_id → profiles.id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bids_manufacturer_id_fkey'
  ) THEN
    ALTER TABLE bids
      ADD CONSTRAINT bids_manufacturer_id_fkey
      FOREIGN KEY (manufacturer_id) REFERENCES profiles(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added: bids_manufacturer_id_fkey';
  ELSE
    RAISE NOTICE 'Already exists: bids_manufacturer_id_fkey';
  END IF;

  -- 2) posts.manufacturer_id → profiles.id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'posts_manufacturer_id_fkey'
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_manufacturer_id_fkey
      FOREIGN KEY (manufacturer_id) REFERENCES profiles(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added: posts_manufacturer_id_fkey';
  ELSE
    RAISE NOTICE 'Already exists: posts_manufacturer_id_fkey';
  END IF;

  -- 3) posts.request_id → requests.id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'posts_request_id_fkey'
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_request_id_fkey
      FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added: posts_request_id_fkey';
  ELSE
    RAISE NOTICE 'Already exists: posts_request_id_fkey';
  END IF;

  -- 4) posts.bid_id → bids.id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'posts_bid_id_fkey'
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_bid_id_fkey
      FOREIGN KEY (bid_id) REFERENCES bids(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added: posts_bid_id_fkey';
  ELSE
    RAISE NOTICE 'Already exists: posts_bid_id_fkey';
  END IF;

END $$;

-- 추가 확인 쿼리 (실행 후 4개 row가 나와야 정상)
SELECT conname AS constraint_name,
       conrelid::regclass AS "table",
       confrelid::regclass AS references
FROM pg_constraint
WHERE contype = 'f'
  AND conrelid::regclass::text IN ('bids', 'posts')
  AND conname IN (
    'bids_manufacturer_id_fkey',
    'posts_manufacturer_id_fkey',
    'posts_request_id_fkey',
    'posts_bid_id_fkey'
  )
ORDER BY "table", constraint_name;

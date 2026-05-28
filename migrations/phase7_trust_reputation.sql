-- =====================================================
-- Phase 7: 신뢰 시스템 (Trust & Reputation)
-- posts·profiles 확장 + 의뢰별 후기 1회 제약
-- =====================================================
-- Supabase SQL Editor에서 실행하세요. 모두 IF NOT EXISTS 안전.

-- 1) posts 테이블에 거래 연결 컬럼 추가
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS request_id      uuid,
  ADD COLUMN IF NOT EXISTS manufacturer_id uuid,
  ADD COLUMN IF NOT EXISTS bid_id          uuid;

-- 의뢰자 1명이 한 의뢰에 후기 1회만 작성 가능
CREATE UNIQUE INDEX IF NOT EXISTS uniq_review_per_request
  ON posts(user_id, request_id)
  WHERE post_type = 'review' AND request_id IS NOT NULL;

-- 생산자별 후기 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_posts_manufacturer
  ON posts(manufacturer_id)
  WHERE post_type = 'review';

-- 2) profiles 테이블에 평점 캐시 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avg_rating      numeric(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_reviews   integer      DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_count integer      DEFAULT 0;

-- 캐시는 클라이언트 Reviews.recomputeProfileStats(manufacturerId)가 갱신.
-- 진실 데이터는 posts(post_type='review', manufacturer_id=...) AVG/COUNT 와
--                requests(matched_bid_id의 manufacturer_id=..., status='completed') COUNT.

-- =====================================================
-- Phase 4: 거래 완결성 (Transaction Closure)
-- requests 테이블에 결제·배송·완료 컬럼 추가
-- =====================================================
-- Supabase SQL Editor에서 실행하세요.
-- 모든 ALTER는 IF NOT EXISTS로 중복 실행 안전.

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS payment_status   text     DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_amount   numeric,
  ADD COLUMN IF NOT EXISTS payment_method   text,
  ADD COLUMN IF NOT EXISTS paid_at          timestamptz,
  ADD COLUMN IF NOT EXISTS tracking_number  text,
  ADD COLUMN IF NOT EXISTS shipped_at       timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS matched_bid_id   uuid;

-- payment_status 허용값: 'unpaid' | 'paid' | 'released' | 'refunded'
-- 상태 머신:
--   bidding  ──의뢰자 confirmMatch()──▶ matched   (paid)
--   matched  ──생산자 startProduction()──▶ producing
--   producing ──생산자 markShipped(tracking)──▶ shipping
--   shipping ──의뢰자 confirmDelivery() OR 7일 자동──▶ completed (released)

-- 옵션: 외래키 제약 (이미 매칭된 의뢰가 있다면 add constraint를 나중에 적용하세요)
-- ALTER TABLE requests
--   ADD CONSTRAINT requests_matched_bid_fk
--   FOREIGN KEY (matched_bid_id) REFERENCES bids(id) ON DELETE SET NULL;

-- 조회 성능 최적화 (선택)
CREATE INDEX IF NOT EXISTS idx_requests_payment_status ON requests(payment_status);
CREATE INDEX IF NOT EXISTS idx_requests_matched_bid_id ON requests(matched_bid_id);
CREATE INDEX IF NOT EXISTS idx_requests_shipping_overdue
  ON requests(shipped_at)
  WHERE status = 'shipping';

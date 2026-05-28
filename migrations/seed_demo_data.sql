-- =====================================================
-- GoodsFactory 시연용 더미 시드 데이터
-- 의뢰 5건 + 입찰 + 완료 거래 + 후기 포함
-- =====================================================
-- 실행 전 확인: SELECT id FROM profiles LIMIT 3;
-- test@test.com 계정의 user_id를 아래에 적용하세요.
-- Supabase SQL Editor에서 실행하세요.
-- =====================================================

-- ❗ 아래 두 UUID를 실제 값으로 교체하세요:
-- YOUR_CLIENT_USER_ID   : test@test.com 계정 (의뢰자)
-- YOUR_MFG_USER_ID      : 생산자로 사용할 다른 계정
-- (두 계정이 같아도 시연은 가능하지만, 두 탭/계정이면 더 생생함)

DO $$
DECLARE
  client_id  uuid;
  mfg_id     uuid;
  r1_id uuid; r2_id uuid; r3_id uuid; r4_id uuid; r5_id uuid;
  b1_id uuid; b2_id uuid; b3_id uuid;
  deadline   date := CURRENT_DATE + 7;
BEGIN

  -- ── 0. 계정 조회 (profiles 첫 2개 사용) ──────────
  SELECT id INTO client_id FROM profiles ORDER BY created_at ASC  LIMIT 1;
  SELECT id INTO mfg_id    FROM profiles ORDER BY created_at DESC LIMIT 1;

  -- 같은 계정이면 자기 자신이 입찰하는 시나리오 (시연 OK)

  -- ── 1. 의뢰 5건 생성 ─────────────────────────────
  INSERT INTO requests(id, user_id, title, category, quantity, target_price, design_guide, detail_note, status, request_type, bid_deadline)
  VALUES
    (gen_random_uuid(), client_id, '기업 로고 아크릴 키링', '아크릴굿즈', 500, 1500,
     '로고 단색 인쇄, 양면 코팅', '납기 2주 이내', 'bidding', 'business', deadline),
    (gen_random_uuid(), client_id, '팬클럽 응원봉 패키지', '봉제인형', 200, 8000,
     'LED 응원봉 + 포장박스, Pantone 컬러 지정', '납기 3주 이내', 'bidding', 'business', deadline),
    (gen_random_uuid(), client_id, '커스텀 에코백 300매', '의류/패브릭', 300, 4500,
     '양면 실크스크린, 그립 내부 포켓 포함', 'GOTS 인증 원단 가능하면 좋겠습니다', 'bidding', 'personal', deadline),
    (gen_random_uuid(), client_id, '기업 명함 홀더 대량', '생활용품', 1000, 900,
     '아크릴 투명, 레이저 각인', '박스 포장 개별 납품', 'bidding', 'business', deadline),
    (gen_random_uuid(), client_id, '핸드폰 케이스 소량 주문', '아크릴굿즈', 50, 12000,
     '아이폰 16 Pro 맞춤형, UV 프린팅', '샘플 1개 먼저 확인 후 진행', 'bidding', 'personal', deadline);

  -- ID를 SELECT로 조회
  SELECT id INTO r1_id FROM requests WHERE user_id=client_id AND title='기업 로고 아크릴 키링' ORDER BY created_at DESC LIMIT 1;
  SELECT id INTO r2_id FROM requests WHERE user_id=client_id AND title='팬클럽 응원봉 패키지'   ORDER BY created_at DESC LIMIT 1;
  SELECT id INTO r3_id FROM requests WHERE user_id=client_id AND title='커스텀 에코백 300매'    ORDER BY created_at DESC LIMIT 1;
  SELECT id INTO r4_id FROM requests WHERE user_id=client_id AND title='기업 명함 홀더 대량'    ORDER BY created_at DESC LIMIT 1;
  SELECT id INTO r5_id FROM requests WHERE user_id=client_id AND title='핸드폰 케이스 소량 주문' ORDER BY created_at DESC LIMIT 1;

  -- ── 2. 생산자 프로필 업데이트 ────────────────────
  UPDATE profiles SET
    nickname          = '굿즈팩토리 공장',
    specialty         = '아크릴굿즈, 의류/패브릭',
    manufacturer_intro= '10년 경력 굿즈 전문 제조사. 최소 100개~대량 가능. 납기 엄수.',
    max_quantity      = 10000,
    min_quantity      = 100
  WHERE id = mfg_id;

  -- ── 3. 입찰 3건 (r1, r2, r3에만) ────────────────
  INSERT INTO bids(id, request_id, manufacturer_id, manufacturer_name, manufacturer_specialty, unit_price, total_price, delivery_days, note, status)
  VALUES
    (gen_random_uuid(), r1_id, mfg_id, '굿즈팩토리 공장', '아크릴굿즈', 1300, 1300*500, 10,
     '고광택 UV코팅 포함, 샘플 제공 가능', 'pending'),
    (gen_random_uuid(), r2_id, mfg_id, '굿즈팩토리 공장', '아크릴굿즈', 7500, 7500*200, 14,
     'LED 모듈 자체 제작, Pantone 정밀 매칭', 'pending'),
    (gen_random_uuid(), r3_id, mfg_id, '굿즈팩토리 공장', '의류/패브릭', 4000, 4000*300, 12,
     'GOTS 인증 원단 사용 가능', 'pending');

  -- ID를 SELECT로 조회
  SELECT id INTO b2_id FROM bids WHERE request_id=r2_id AND manufacturer_id=mfg_id ORDER BY created_at DESC LIMIT 1;
  SELECT id INTO b3_id FROM bids WHERE request_id=r3_id AND manufacturer_id=mfg_id ORDER BY created_at DESC LIMIT 1;

  -- ── 4. r3: completed 거래 1건 만들기 (후기 시연용) ──
  -- 4-1) 입찰 선택
  UPDATE bids SET status='selected' WHERE id=b3_id;
  UPDATE bids SET status='rejected' WHERE request_id=r3_id AND id != b3_id;

  -- 4-2) 의뢰 completed 처리
  UPDATE requests SET
    status          = 'completed',
    matched_bid_id  = b3_id,
    payment_status  = 'released',
    payment_amount  = 4000 * 300,
    payment_method  = '신용카드',
    paid_at         = now() - interval '5 days',
    shipped_at      = now() - interval '3 days',
    tracking_number = '1234567890123',
    completed_at    = now() - interval '1 day'
  WHERE id = r3_id;

  -- 4-3) match_history 기록
  INSERT INTO match_history(request_id, bid_id, category, title, quantity, target_price, matched_price, request_type)
  VALUES (r3_id, b3_id, '의류/패브릭', '커스텀 에코백 300매', 300, 4500, 4000, 'personal');

  -- ── 5. 후기 1건 (r3 거래에 대한 후기) ─────────────
  INSERT INTO posts(user_id, post_type, title, content, rating, author_name, author_type, request_id, manufacturer_id, bid_id)
  VALUES (
    client_id, 'review',
    '납기도 빠르고 품질도 최고였습니다!',
    '에코백 실크스크린 인쇄 품질이 기대 이상이었습니다. 소통도 빠르고 중간 샘플도 보내주셔서 수정 반영이 잘 됐어요. 다음 주문도 꼭 맡길 예정입니다.',
    5, '시연_의뢰자', 'client', r3_id, mfg_id, b3_id
  );

  -- ── 6. 프로필 평점 캐시 업데이트 ────────────────
  UPDATE profiles SET
    avg_rating      = 5.0,
    total_reviews   = 1,
    completed_count = 1
  WHERE id = mfg_id;

  RAISE NOTICE '시드 데이터 삽입 완료: 의뢰 5건, 입찰 3건, 완료거래 1건, 후기 1건';
  RAISE NOTICE '의뢰자: %', client_id;
  RAISE NOTICE '생산자: %', mfg_id;
END $$;

-- 확인 쿼리
SELECT 'requests' AS tbl, COUNT(*) FROM requests
UNION ALL
SELECT 'bids', COUNT(*) FROM bids
UNION ALL
SELECT 'posts(review)', COUNT(*) FROM posts WHERE post_type='review'
UNION ALL
SELECT 'match_history', COUNT(*) FROM match_history;

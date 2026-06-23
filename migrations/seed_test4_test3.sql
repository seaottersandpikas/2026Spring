-- =====================================================
-- seed_test4_test3.sql
-- test4: 개별의뢰 2건 + 공동제작 의뢰 2건
-- test3: 생산자 홍보글 2건
-- Supabase SQL Editor에서 실행하세요.
-- =====================================================

DO $$
DECLARE
  test4_id  uuid;
  test3_id  uuid;
  test3_nick text;
  r1_id uuid; r2_id uuid; r3_id uuid; r4_id uuid;
  deadline  date := CURRENT_DATE + 10;
BEGIN

  SELECT id INTO test4_id FROM profiles WHERE email = 'test4@test.com';
  SELECT id, nickname INTO test3_id, test3_nick FROM profiles WHERE email = 'test3@test.com';

  IF test4_id IS NULL THEN RAISE EXCEPTION 'test4@test.com 계정 없음'; END IF;
  IF test3_id IS NULL THEN RAISE EXCEPTION 'test3@test.com 계정 없음'; END IF;

  -- ── 1. test4 개별의뢰 2건 ────────────────────────

  INSERT INTO requests(id, user_id, title, category, quantity, target_price, design_guide, detail_note, status, request_type, bidding_type, bid_deadline)
  VALUES (gen_random_uuid(), test4_id,
    '사무실 로고 머그컵 제작', '생활용품', 200, 8000,
    '회사 로고 실크스크린, 백색 세라믹, 용량 350ml',
    '납기 2주 이내, 개별 박스 포장 필요',
    'bidding', 'business', 'bidding', deadline)
  RETURNING id INTO r1_id;

  INSERT INTO requests(id, user_id, title, category, quantity, target_price, design_guide, detail_note, status, request_type, bidding_type, bid_deadline)
  VALUES (gen_random_uuid(), test4_id,
    '신입사원 환영 굿즈 세트', '아크릴굿즈', 150, 5500,
    '아크릴 키링 + 스티커 세트, 회사 캐릭터 디자인',
    '입사 키트 포함용, 납기 3주',
    'bidding', 'business', 'bidding', deadline)
  RETURNING id INTO r2_id;

  -- 개별의뢰 더미 입찰 (test3가 입찰한 것처럼)
  INSERT INTO bids(request_id, manufacturer_id, manufacturer_name, manufacturer_specialty, unit_price, total_price, delivery_days, note, status)
  VALUES
    (r1_id, test3_id, test3_nick, '생활용품, 금속/뱃지', 7200, 7200*200, 12,
     '세라믹 전문 라인 보유, 샘플 무료 제공', 'pending'),
    (r2_id, test3_id, test3_nick, '아크릴굿즈', 5000, 5000*150, 14,
     '키링+스티커 동시 제작 가능, UV 코팅 포함', 'pending');

  -- ── 2. test4 공동제작 의뢰 2건 ──────────────────

  INSERT INTO requests(id, user_id, title, category, quantity, min_quantity, current_quantity, target_price, design_guide, detail_note, status, request_type, bidding_type, recruit_deadline, bid_deadline)
  VALUES (gen_random_uuid(), test4_id,
    '캠퍼스 굿즈 에코백 공동제작', '의류/패브릭', 300, 80, 40, 6000,
    '캔버스 소재, 양면 프린팅, 사이즈 38x42cm',
    '환경부 인증 원단 선호, 납기 4주',
    'bidding', 'group', 'bidding',
    CURRENT_DATE + 7, deadline)
  RETURNING id INTO r3_id;

  INSERT INTO requests(id, user_id, title, category, quantity, min_quantity, current_quantity, target_price, design_guide, detail_note, status, request_type, bidding_type, recruit_deadline, bid_deadline)
  VALUES (gen_random_uuid(), test4_id,
    '졸업 기념 포토카드 팩', '문구/스티커', 500, 100, 60, 1200,
    '5종 디자인, 포토카드 규격 55x85mm, 광택 코팅',
    '졸업식 배포용, 봉투 포장 포함',
    'bidding', 'group', 'bidding',
    CURRENT_DATE + 5, deadline)
  RETURNING id INTO r4_id;

  -- 공동제작 참여자 등록 (test4 본인)
  INSERT INTO group_participants(request_id, user_id, quantity)
  VALUES
    (r3_id, test4_id, 40),
    (r4_id, test4_id, 60);

  -- ── 3. test3 생산자 홍보글 2건 ──────────────────

  INSERT INTO posts(user_id, post_type, title, content, author_name, author_type)
  VALUES
    (test3_id, 'promo',
     '🏭 굿즈 전문 공장 — 아크릴·금속 소량부터 대량까지',
     '안녕하세요! 10년 경력 굿즈 전문 공장입니다.

【주요 제작 품목】
• 아크릴 키링 / 스탠드 / 뱃지
• 금속 배지 / 핀버튼
• 머그컵 / 텀블러 각인

【강점】
✔ 최소 50개부터 제작 가능
✔ 샘플 제작 후 본 발주 진행
✔ 납기 엄수 — 평균 납기 12일
✔ 디자인 보정 무료 지원

현재 입찰 중인 의뢰는 빠른 견적 드립니다. 언제든 문의 환영합니다!',
     test3_nick, 'manufacturer'),

    (test3_id, 'promo',
     '📦 이달의 특가 — 아크릴 키링 100개 이상 15% 할인',
     '6월 한정 프로모션을 진행합니다!

【이달의 특가】
아크릴 키링 100개 이상 주문 시 → 단가 15% 할인
포장재 업그레이드 무료 제공 (OPP봉투 → 도무송 패키지)

【납기】
• 100~300개: 7일
• 300개 이상: 12일

지금 바로 의뢰를 등록하고 입찰을 받아보세요.
최저가 경쟁 입찰로 합리적인 단가를 제안드립니다.',
     test3_nick, 'manufacturer');

  RAISE NOTICE '✅ 시드 데이터 삽입 완료';
  RAISE NOTICE 'test4 개별의뢰: %, %', r1_id, r2_id;
  RAISE NOTICE 'test4 공동제작: %, %', r3_id, r4_id;
  RAISE NOTICE 'test3 홍보글 2건 등록';
END $$;

-- 확인
SELECT
  (SELECT COUNT(*) FROM requests WHERE user_id = (SELECT id FROM profiles WHERE email='test4@test.com')) AS test4_requests,
  (SELECT COUNT(*) FROM posts WHERE user_id = (SELECT id FROM profiles WHERE email='test3@test.com') AND post_type='promo') AS test3_promo_posts;

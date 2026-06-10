-- =====================================================
-- Phase 11 시연용 추가 시드 데이터
-- 공동제작 2건 + 홍보글 2건 + 후기 추가 3건 + 매칭이력 추가
-- seed_demo_data.sql 실행 후 이어서 실행하세요.
-- =====================================================

DO $$
DECLARE
  client_id  uuid;
  mfg_id     uuid;
  mfg2_id    uuid;
  g1_id uuid; g2_id uuid;
  r3_id uuid;
  b3_id uuid;
  dummy_bid1 uuid; dummy_bid2 uuid; dummy_bid3 uuid; dummy_bid4 uuid;
  deadline   date := CURRENT_DATE + 14;
BEGIN

  -- ── 0. 계정 조회 ──────────────────────────────────
  SELECT id INTO client_id FROM profiles WHERE email = 'test2@test.com' LIMIT 1;
  SELECT id INTO mfg_id    FROM profiles WHERE email = 'test@test.com'  LIMIT 1;
  SELECT id INTO mfg2_id   FROM profiles WHERE email = 'test3@test.com' LIMIT 1;

  -- fallback: 이메일 조회 실패 시 첫/마지막 계정
  IF client_id IS NULL THEN SELECT id INTO client_id FROM profiles ORDER BY created_at ASC  LIMIT 1; END IF;
  IF mfg_id    IS NULL THEN SELECT id INTO mfg_id    FROM profiles ORDER BY created_at DESC LIMIT 1; END IF;
  IF mfg2_id   IS NULL THEN mfg2_id := mfg_id; END IF;

  SELECT id INTO r3_id FROM requests WHERE title='커스텀 에코백 300매' ORDER BY created_at DESC LIMIT 1;
  SELECT id INTO b3_id FROM bids     WHERE request_id=r3_id AND status='selected' LIMIT 1;

  -- ── 1. 공동제작 의뢰 2건 ──────────────────────────
  INSERT INTO requests(id, user_id, title, category, quantity, min_quantity, current_quantity,
                       target_price, design_guide, detail_note, status, request_type, bid_deadline, bidding_type)
  VALUES
    (gen_random_uuid(), client_id,
     '인디밴드 굿즈 - 포토카드 세트', '문구/스티커', 200, 100, 74,
     800, '4종 세트 각 엽서 사이즈, 양면 코팅', '포장비닐 포함, 소분 가능하면 좋겠어요',
     'bidding', 'group', deadline, 'bidding'),
    (gen_random_uuid(), client_id,
     '동아리 단체 티셔츠 제작', '의류/패브릭', 150, 50, 42,
     15000, '등번호 + 이름 개별 인쇄, 흰색 기본', '사이즈 XS~XXL 혼합 주문',
     'bidding', 'group', deadline, 'bidding');

  SELECT id INTO g1_id FROM requests WHERE title='인디밴드 굿즈 - 포토카드 세트' ORDER BY created_at DESC LIMIT 1;
  SELECT id INTO g2_id FROM requests WHERE title='동아리 단체 티셔츠 제작' ORDER BY created_at DESC LIMIT 1;

  -- 공동제작 참여자 더미
  INSERT INTO group_participants(request_id, user_id, quantity)
  VALUES
    (g1_id, client_id, 20),
    (g2_id, client_id, 10)
  ON CONFLICT DO NOTHING;

  -- ── 2. 매칭이력 추가 (마켓플레이스 최근 매칭 조회용) ──
  dummy_bid1 := gen_random_uuid();
  dummy_bid2 := gen_random_uuid();
  dummy_bid3 := gen_random_uuid();
  dummy_bid4 := gen_random_uuid();

  INSERT INTO bids(id, request_id, manufacturer_id, manufacturer_name, unit_price, delivery_days, status)
  VALUES
    (dummy_bid1, g1_id,             mfg_id, '굿즈팩토리 공장', 720,   10, 'selected'),
    (dummy_bid2, g2_id,             mfg_id, '굿즈팩토리 공장', 13500, 14, 'selected'),
    (dummy_bid3, r3_id,             mfg_id, '굿즈팩토리 공장', 2800,  12, 'selected'),
    (dummy_bid4, r3_id,             mfg_id, '굿즈팩토리 공장', 2100,  10, 'selected');

  INSERT INTO match_history(request_id, bid_id, category, title, quantity, target_price, matched_price, request_type)
  VALUES
    (g1_id, dummy_bid1, '문구/스티커', '인디밴드 굿즈 - 포토카드 세트', 100, 800,   720,   'group'),
    (g2_id, dummy_bid2, '의류/패브릭', '동아리 단체 티셔츠 제작',       50,  15000, 13500, 'group'),
    (r3_id, dummy_bid3, '아크릴굿즈', '아이돌 응원 아크릴 스탠드',      300, 3200,  2800,  'business'),
    (r3_id, dummy_bid4, '금속/뱃지',  '기업 기념 배지 제작',            500, 2500,  2100,  'business');

  -- ── 3. 후기 추가 3건 ──────────────────────────────
  INSERT INTO posts(user_id, post_type, title, content, rating, author_name, author_type, manufacturer_id)
  VALUES
    (client_id, 'review',
     '작은 수량도 꼼꼼하게 챙겨줘요',
     '50개 소량 주문인데도 불량 하나 없이 왔어요. 포장도 깔끔하고, 배송도 예정일보다 하루 빨리 도착했습니다. 다음에도 부탁드릴게요!',
     4, '시연_의뢰자B', 'personal', mfg_id),
    (client_id, 'review',
     '수정 요청에 빠르게 대응해주셨어요',
     '초안 시안을 보내주셨는데 색상이 조금 달라서 수정 요청했는데 당일에 바로 수정해주셨어요. 최종 결과물 매우 만족합니다.',
     5, '시연_의뢰자C', 'business', mfg2_id),
    (client_id, 'review',
     '가격 대비 퀄리티 훌륭합니다',
     '다른 업체보다 20% 저렴한데 품질은 오히려 더 좋았어요. 대량 주문이었는데 납기도 정확히 지켜주셨고, 재주문 예정입니다.',
     5, '시연_의뢰자D', 'business', mfg_id);

  -- ── 4. 생산자 홍보글 2건 ──────────────────────────
  INSERT INTO posts(user_id, post_type, title, content, author_name, author_type)
  VALUES
    (mfg_id, 'promo',
     '아크릴 & 패브릭 전문 제조사 | MOQ 100개~',
     '안녕하세요, 굿즈팩토리 공장입니다 🏭

10년 이상 아이돌 굿즈, 기업 판촉물, 패션 브랜드 OEM을 담당해온 전문 제조사입니다.

【 제작 가능 품목 】
✅ 아크릴 키링 / 아크릴 스탠딩 / 포토카드 홀더
✅ 에코백 / 후드티 / 단체복 실크스크린 인쇄
✅ 스티커 / 엽서 / 포토카드

【 장점 】
• 최소 주문 수량 100개부터
• 납기 엄수 (평균 10~14일)
• 샘플 제작 후 본 생산 진행
• GOTS 인증 원단 사용 가능

관심 있으신 분은 직접 의뢰 코드로 문의해 주세요!',
     '굿즈팩토리 공장', 'manufacturer'),
    (mfg2_id, 'promo',
     '대형 설비 보유 | 대량 발주 전문 공장',
     '안녕하세요, 대형 설비를 보유한 공장 생산자입니다 🏗️

대량 발주에 특화된 제조 시설로 빠르고 안정적인 생산이 가능합니다.

【 생산 능력 】
✅ 월 최대 50,000개 생산 가능
✅ 자동화 라인 보유로 품질 균일
✅ ISO 9001 품질관리 인증

【 전문 분야 】
• 아크릴굿즈 대량 생산
• 금속 뱃지 / 메달 제작
• 패키징 / 포장재

B2B 대량 발주 전문이며, 장기 거래 시 단가 협의 가능합니다.',
     '대형공장테스터', 'manufacturer');

  -- ── 5. 생산자 프로필 캐시 업데이트 ──────────────────
  UPDATE profiles SET
    avg_rating      = 4.7,
    total_reviews   = 3,
    completed_count = 3
  WHERE id = mfg_id;

  UPDATE profiles SET
    avg_rating      = 5.0,
    total_reviews   = 1,
    completed_count = 1,
    nickname        = COALESCE(NULLIF(nickname, ''), '대형공장테스터'),
    specialty       = '아크릴굿즈, 금속/뱃지'
  WHERE id = mfg2_id;

  RAISE NOTICE '추가 시드 완료: 공동제작 2건, 매칭이력 4건 추가, 후기 3건, 홍보글 2건';
END $$;

-- 확인
SELECT post_type, COUNT(*) FROM posts GROUP BY post_type;
SELECT request_type, COUNT(*) FROM requests GROUP BY request_type;
SELECT COUNT(*) AS match_history_count FROM match_history;

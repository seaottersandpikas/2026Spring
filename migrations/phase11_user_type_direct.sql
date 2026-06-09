-- =====================================================
-- Phase 11: 유저 타입 세분화 + 생산자 직접 의뢰
-- Supabase SQL Editor에서 실행하세요.
-- =====================================================

-- ① profiles 테이블 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS manufacturer_type text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS manufacturer_code text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS avatar_url        text    DEFAULT NULL;

-- manufacturer_type: 'factory' | 'personal' | NULL(의뢰자)
-- manufacturer_code: 8자리 영숫자 고유코드 (직접 의뢰용)

-- ② manufacturer_code 유니크 제약
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_manufacturer_code_key'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_manufacturer_code_key UNIQUE (manufacturer_code);
  END IF;
END $$;

-- ③ 코드 자동 생성 함수 + 트리거
CREATE OR REPLACE FUNCTION generate_manufacturer_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code text;
  done bool;
BEGIN
  -- 생산자일 때만 코드 부여
  IF NEW.user_type = 'manufacturer' AND NEW.manufacturer_code IS NULL THEN
    done := false;
    WHILE NOT done LOOP
      new_code := upper(substring(md5(random()::text) FROM 1 FOR 8));
      BEGIN
        NEW.manufacturer_code := new_code;
        done := true;
      EXCEPTION WHEN unique_violation THEN
        -- 충돌 시 재시도
      END;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_manufacturer_code ON profiles;
CREATE TRIGGER set_manufacturer_code
  BEFORE INSERT OR UPDATE OF user_type ON profiles
  FOR EACH ROW EXECUTE FUNCTION generate_manufacturer_code();

-- ④ 기존 생산자 계정에 코드 부여 (트리거 소급 적용)
UPDATE profiles
SET manufacturer_code = upper(substring(md5(random()::text) FROM 1 FOR 8))
WHERE user_type = 'manufacturer' AND manufacturer_code IS NULL;

-- ⑤ 기존 test@test.com → 개인 생산자 설정
UPDATE profiles SET manufacturer_type = 'personal'
WHERE email = 'test@test.com' AND user_type = 'manufacturer';

-- ⑥ test3@test.com, test4@test.com 계정 profiles 업데이트
--    (Supabase 대시보드에서 Auth 계정 생성 후 아래 주석 해제 실행)
--
-- INSERT INTO profiles (id, email, nickname, user_type, manufacturer_type)
-- VALUES (
--   (SELECT id FROM auth.users WHERE email = 'test3@test.com'),
--   'test3@test.com', '공장테스터', 'manufacturer', 'factory'
-- )
-- ON CONFLICT (id) DO UPDATE
--   SET user_type = 'manufacturer', manufacturer_type = 'factory', nickname = '공장테스터';
--
-- INSERT INTO profiles (id, email, nickname, user_type)
-- VALUES (
--   (SELECT id FROM auth.users WHERE email = 'test4@test.com'),
--   'test4@test.com', '사업자테스터', 'business'
-- )
-- ON CONFLICT (id) DO UPDATE
--   SET user_type = 'business', nickname = '사업자테스터';

-- ⑦ 확인 쿼리
SELECT email, user_type, manufacturer_type, manufacturer_code, avatar_url
FROM profiles
WHERE email IN ('test@test.com','test2@test.com','test3@test.com','test4@test.com');

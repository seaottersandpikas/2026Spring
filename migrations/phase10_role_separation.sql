-- =====================================================
-- Phase 10: 역할 분리 + 후기/홍보 개선
-- Supabase SQL Editor에서 실행하세요.
-- =====================================================

-- ① posts 테이블에 이미지 배열 + 취소 사유 컬럼 추가
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS images        text[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cancel_reason text    DEFAULT NULL;

-- ② Storage bucket "post-images" 생성 방법
--    Supabase 대시보드 → Storage → New Bucket
--    Name: post-images  /  Public: true (체크)
--    생성 후 아래 RLS 정책 실행:

INSERT INTO storage.buckets (id, name, public) VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "post_images_select_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'post-images');

CREATE POLICY "post_images_insert_auth" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'post-images' AND auth.role() = 'authenticated');

-- ③ test@test.com → 생산자(manufacturer) 타입으로 업데이트
UPDATE profiles
SET user_type = 'manufacturer'
WHERE email = 'test@test.com';

-- ④ [test2@test.com 가입 완료 후] 기존 의뢰 이관
--    아래 주석을 해제하고 실행하세요:
--
-- UPDATE requests
-- SET user_id = (SELECT id FROM auth.users WHERE email = 'test2@test.com')
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test@test.com');
--
-- UPDATE group_participants
-- SET user_id = (SELECT id FROM auth.users WHERE email = 'test2@test.com')
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test@test.com');
--
-- UPDATE posts
-- SET user_id = (SELECT id FROM auth.users WHERE email = 'test2@test.com')
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test@test.com')
--   AND post_type = 'review';

-- 완료 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'posts'
  AND column_name IN ('images', 'cancel_reason');


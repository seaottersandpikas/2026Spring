-- =====================================================
-- Phase 9: Row Level Security (RLS) 정책
-- 현재 anon key로 모든 row 접근 가능한 상태를 제한
-- =====================================================
-- Supabase SQL Editor에서 실행하세요.
-- 순서: 1) RLS 활성화 → 2) 정책 추가
-- =====================================================

-- ══════════════════════════════════════════════════
-- 1. requests 테이블
-- ══════════════════════════════════════════════════
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

-- 전체 공개 조회 (입찰중 의뢰는 생산자도 봐야 함)
CREATE POLICY "requests_select_public" ON requests
  FOR SELECT USING (true);

-- 생성: 본인만
CREATE POLICY "requests_insert_own" ON requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 수정: 본인만 (상태 전환도 포함)
CREATE POLICY "requests_update_own" ON requests
  FOR UPDATE USING (auth.uid() = user_id);

-- 삭제: 본인만
CREATE POLICY "requests_delete_own" ON requests
  FOR DELETE USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════
-- 2. bids 테이블
-- ══════════════════════════════════════════════════
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- 조회: 입찰자 본인 또는 해당 의뢰 소유자
CREATE POLICY "bids_select" ON bids
  FOR SELECT USING (
    auth.uid() = manufacturer_id
    OR auth.uid() = (SELECT user_id FROM requests WHERE id = bids.request_id)
  );

-- 생성: 생산자 본인
CREATE POLICY "bids_insert_own" ON bids
  FOR INSERT WITH CHECK (auth.uid() = manufacturer_id);

-- 수정: 입찰자 본인 또는 해당 의뢰 소유자 (status 변경 포함)
CREATE POLICY "bids_update" ON bids
  FOR UPDATE USING (
    auth.uid() = manufacturer_id
    OR auth.uid() = (SELECT user_id FROM requests WHERE id = bids.request_id)
  );


-- ══════════════════════════════════════════════════
-- 3. profiles 테이블
-- ══════════════════════════════════════════════════
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 조회: 전체 공개 (닉네임·평점은 공개 정보)
CREATE POLICY "profiles_select_public" ON profiles
  FOR SELECT USING (true);

-- 수정: 본인만
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);


-- ══════════════════════════════════════════════════
-- 4. posts 테이블
-- ══════════════════════════════════════════════════
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- 조회: 전체 공개
CREATE POLICY "posts_select_public" ON posts
  FOR SELECT USING (true);

-- 생성: 본인만
CREATE POLICY "posts_insert_own" ON posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 수정·삭제: 본인만
CREATE POLICY "posts_update_own" ON posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "posts_delete_own" ON posts
  FOR DELETE USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════
-- 5. notifications 테이블
-- ══════════════════════════════════════════════════
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 조회: 본인 알림만
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- 생성: 로그인 사용자 누구나 (상대방에게 알림 발송)
CREATE POLICY "notifications_insert_auth" ON notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 수정(읽음 처리): 본인만
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════
-- 6. match_history 테이블
-- ══════════════════════════════════════════════════
ALTER TABLE match_history ENABLE ROW LEVEL SECURITY;

-- 조회: 전체 공개 (마켓플레이스 시장가 참고용)
CREATE POLICY "match_history_select_public" ON match_history
  FOR SELECT USING (true);

-- 생성: 로그인 사용자 (confirmMatch 시 server-side에서 insert)
CREATE POLICY "match_history_insert_auth" ON match_history
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');


-- ══════════════════════════════════════════════════
-- 7. request_files 테이블 (있는 경우)
-- ══════════════════════════════════════════════════
ALTER TABLE request_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "request_files_select" ON request_files
  FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM requests WHERE id = request_files.request_id)
    OR auth.uid() = (
      SELECT manufacturer_id FROM bids
      WHERE request_id = request_files.request_id AND status IN ('pending','selected')
      LIMIT 1
    )
  );

CREATE POLICY "request_files_insert_own" ON request_files
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT user_id FROM requests WHERE id = request_files.request_id)
  );


-- ══════════════════════════════════════════════════
-- 8. bid_files 테이블 (있는 경우)
-- ══════════════════════════════════════════════════
ALTER TABLE bid_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bid_files_select" ON bid_files
  FOR SELECT USING (
    auth.uid() = (SELECT manufacturer_id FROM bids WHERE id = bid_files.bid_id)
    OR auth.uid() = (
      SELECT r.user_id FROM requests r
      JOIN bids b ON b.request_id = r.id
      WHERE b.id = bid_files.bid_id
      LIMIT 1
    )
  );

CREATE POLICY "bid_files_insert_own" ON bid_files
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT manufacturer_id FROM bids WHERE id = bid_files.bid_id)
  );


-- ══════════════════════════════════════════════════
-- 확인 쿼리: RLS 활성화 테이블 목록
-- ══════════════════════════════════════════════════
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'requests','bids','profiles','posts',
    'notifications','match_history','request_files','bid_files'
  )
ORDER BY tablename;

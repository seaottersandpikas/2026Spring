-- =====================================================
-- Phase 11 추가: group_participants RLS + 공동제작 개선
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

-- ① group_participants RLS 정책 추가
ALTER TABLE group_participants ENABLE ROW LEVEL SECURITY;

-- 조회: 본인 참여 내역
CREATE POLICY IF NOT EXISTS "gp_select_own" ON group_participants
  FOR SELECT USING (auth.uid() = user_id);

-- 삽입: 로그인한 사용자 누구나
CREATE POLICY IF NOT EXISTS "gp_insert_auth" ON group_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 삭제: 본인만
CREATE POLICY IF NOT EXISTS "gp_delete_own" ON group_participants
  FOR DELETE USING (auth.uid() = user_id);

-- 수정: 본인만
CREATE POLICY IF NOT EXISTS "gp_update_own" ON group_participants
  FOR UPDATE USING (auth.uid() = user_id);

-- ② requests 테이블: 공동제작 업데이트 허용 (의뢰자 본인)
-- (기존 requests_update_participant 정책이 있으면 이미 적용됨)

-- ③ 확인
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'group_participants';

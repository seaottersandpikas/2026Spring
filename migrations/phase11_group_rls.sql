-- =====================================================
-- Phase 11 추가: group_participants RLS
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

-- 기존 정책 정리 후 재생성
DROP POLICY IF EXISTS "gp_select_own"  ON group_participants;
DROP POLICY IF EXISTS "gp_insert_auth" ON group_participants;
DROP POLICY IF EXISTS "gp_delete_own"  ON group_participants;
DROP POLICY IF EXISTS "gp_update_own"  ON group_participants;

ALTER TABLE group_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gp_select_own" ON group_participants
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "gp_insert_auth" ON group_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "gp_delete_own" ON group_participants
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "gp_update_own" ON group_participants
  FOR UPDATE USING (auth.uid() = user_id);

-- 확인
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'group_participants';

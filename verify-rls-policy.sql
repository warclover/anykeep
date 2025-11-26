-- 验证 RLS 策略是否正确更新
-- 在 Supabase Dashboard -> SQL Editor 中执行此查询

-- 查询 bookmarks 表的所有策略
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_clause,
  with_check AS with_check_clause
FROM pg_policies
WHERE tablename = 'bookmarks'
ORDER BY policyname;

-- 预期结果:
-- policyname: "Users can update own bookmarks"
-- cmd: UPDATE
-- using_clause: (auth.uid() = user_id)
-- with_check_clause: (auth.uid() = user_id)  <-- 这个必须存在！

-- 如果 with_check_clause 是 NULL 或不存在，说明修复未成功应用

-- =====================================================
-- 修复: PostgREST 函数重载歧义
-- 问题: PGRST203 - Could not choose the best candidate function
-- 解决方案: 删除 INTEGER 版本，只保留 BIGINT 版本
-- 日期: 2026-01-23
-- 版本: V5.0.2
-- =====================================================

-- 删除 INTEGER 版本，避免函数重载歧义
DROP FUNCTION IF EXISTS compute_folder_profile(INTEGER);
DROP FUNCTION IF EXISTS compute_folder_profile(INT);

-- BIGINT 版本已在上一个迁移中创建，无需重复创建
-- 确认 BIGINT 版本存在
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'compute_folder_profile'
  ) THEN
    RAISE EXCEPTION 'compute_folder_profile function not found!';
  END IF;

  RAISE NOTICE 'compute_folder_profile(BIGINT) is ready';
END $$;

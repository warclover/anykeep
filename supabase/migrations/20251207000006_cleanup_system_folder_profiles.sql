-- ============================================================================
-- 清理系统文件夹的 folder_profiles 数据
--
-- 说明：系统文件夹（如"待整理"）不应有 folder_profile 数据，
--       因为它们不应作为智能分类的目标
-- ============================================================================

-- 删除系统文件夹的 folder_profiles 数据
DELETE FROM public.folder_profiles
WHERE folder_id IN (
  SELECT id FROM public.folders WHERE is_system = TRUE
);

-- 显示清理结果（执行后会返回删除的行数）
-- 如果返回 0，说明之前没有错误数据，这是正常的

-- ============================================================================
-- 验证查询：确认没有系统文件夹的 profile 数据
-- ============================================================================
-- 运行以下查询验证：
-- SELECT fp.*, f.name, f.is_system
-- FROM folder_profiles fp
-- JOIN folders f ON f.id = fp.folder_id
-- WHERE f.is_system = TRUE;
--
-- 期望结果：0 行

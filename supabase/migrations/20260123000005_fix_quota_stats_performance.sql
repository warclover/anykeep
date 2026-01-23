-- ===========================================
-- AnyKeep v5.5 - 修复配额统计 N+1 查询
-- ===========================================
-- 版本: 5.5.1
-- 日期: 2026-01-23
-- 说明: 优化 get_unified_quota_stats 函数性能

-- 删除旧函数
DROP FUNCTION IF EXISTS get_unified_quota_stats(UUID);

-- 创建优化后的函数（使用 JOIN 替代子查询）
CREATE OR REPLACE FUNCTION get_unified_quota_stats(p_user_id UUID)
RETURNS TABLE (
  ai_folder_count INT,
  total_folder_count INT,
  empty_folder_count INT,
  total_bookmark_count BIGINT,
  today_created_count INT
) AS $$
BEGIN
  RETURN QUERY
  WITH bookmark_counts AS (
    -- 一次性聚合所有文件夹的书签数
    SELECT folder_id, COUNT(*) AS cnt
    FROM public.bookmarks
    WHERE user_id = p_user_id AND deleted_at IS NULL
    GROUP BY folder_id
  ),
  folder_stats AS (
    SELECT
      f.id,
      f.is_ai_generated,
      COALESCE(bc.cnt, 0) AS bookmark_count
    FROM public.folders f
    LEFT JOIN bookmark_counts bc ON bc.folder_id = f.id
    WHERE f.user_id = p_user_id
      AND f.deleted_at IS NULL
  )
  SELECT
    COUNT(*) FILTER (WHERE fs.is_ai_generated = TRUE)::INT AS ai_folder_count,
    COUNT(*)::INT AS total_folder_count,
    COUNT(*) FILTER (WHERE fs.bookmark_count = 0)::INT AS empty_folder_count,
    (SELECT COUNT(*) FROM public.bookmarks
     WHERE user_id = p_user_id AND deleted_at IS NULL) AS total_bookmark_count,
    (SELECT COUNT(*) FROM public.folders
     WHERE user_id = p_user_id
       AND is_ai_generated = TRUE
       AND created_at >= CURRENT_DATE
       AND deleted_at IS NULL)::INT AS today_created_count
  FROM folder_stats fs;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_unified_quota_stats(UUID) IS
  'V5.5 统一配额统计（优化版）：使用 JOIN 替代 N+1 子查询';

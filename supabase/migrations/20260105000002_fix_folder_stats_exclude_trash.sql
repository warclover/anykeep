-- 修复文件夹书签统计：排除垃圾箱中的书签
-- 问题：统计数量包含 is_in_trash = true 的书签，但列表不显示这些书签
-- 修复：添加 is_in_trash 过滤条件，保持与书签 API 一致

-- 更新聚合函数
CREATE OR REPLACE FUNCTION get_folder_bookmark_stats(
  p_user_id UUID,
  p_folder_ids INTEGER[],
  p_today_start TIMESTAMPTZ
)
RETURNS SETOF folder_bookmark_stats
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    folder_id,
    COUNT(*) as bookmark_count,
    COUNT(CASE WHEN created_at >= p_today_start THEN 1 END) as today_count
  FROM bookmarks
  WHERE
    user_id = p_user_id
    AND deleted_at IS NULL
    AND folder_id = ANY(p_folder_ids)
    -- V4.2.27: 排除垃圾箱中的书签，与书签 API 保持一致
    AND (is_in_trash = false OR is_in_trash IS NULL)
  GROUP BY folder_id;
$$;

-- 添加更新注释
COMMENT ON FUNCTION get_folder_bookmark_stats IS '获取指定文件夹的书签统计（总数 + 今日新增）。V4.2.27: 排除垃圾箱书签。';

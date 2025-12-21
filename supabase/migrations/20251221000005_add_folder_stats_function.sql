-- 文件夹书签统计聚合函数
-- V4.2.26: 优化收藏夹页面性能，使用 SQL 聚合替代内存计算
-- 预期效果：10,000+ 书签场景从 ~2000ms 优化到 ~100ms

-- 创建返回类型
DROP TYPE IF EXISTS folder_bookmark_stats CASCADE;
CREATE TYPE folder_bookmark_stats AS (
  folder_id INTEGER,
  bookmark_count BIGINT,
  today_count BIGINT
);

-- 创建聚合函数
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
  GROUP BY folder_id;
$$;

-- 授权给 authenticated 用户
GRANT EXECUTE ON FUNCTION get_folder_bookmark_stats(UUID, INTEGER[], TIMESTAMPTZ) TO authenticated;

-- 添加注释
COMMENT ON FUNCTION get_folder_bookmark_stats IS '获取指定文件夹的书签统计（总数 + 今日新增），使用 SQL 聚合优化性能';

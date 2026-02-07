-- 收藏统计 RPC 函数
-- 将 6 个独立的查询合并为 1 个 RPC 调用
-- 解决 organize 页面的 N+1 查询性能问题
--
-- 优化效果：6 次数据库往返 → 1 次
-- 预计性能提升：400-600ms → 100-150ms

-- 创建返回类型
DROP TYPE IF EXISTS collection_stats_result CASCADE;
CREATE TYPE collection_stats_result AS (
  total integer,
  uncategorized integer,
  duplicates integer,
  untagged integer,
  stale integer
);

-- 创建 RPC 函数
CREATE OR REPLACE FUNCTION get_collection_stats(p_user_id uuid)
RETURNS collection_stats_result
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result collection_stats_result;
  ninety_days_ago timestamptz := now() - interval '90 days';
  total_count integer;
  unique_url_count integer;
BEGIN
  -- 单次查询获取基础统计
  SELECT
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE folder_id IS NULL)::integer,
    COUNT(*) FILTER (WHERE user_tags IS NULL OR user_tags = '{}')::integer,
    COUNT(*) FILTER (WHERE created_at < ninety_days_ago)::integer
  INTO
    result.total,
    result.uncategorized,
    result.untagged,
    result.stale
  FROM bookmarks
  WHERE user_id = p_user_id
    AND deleted_at IS NULL;

  -- 计算重复 URL 数量（总数 - 去重数 = 重复数）
  SELECT
    COUNT(*)::integer,
    COUNT(DISTINCT url)::integer
  INTO
    total_count,
    unique_url_count
  FROM bookmarks
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
    AND url IS NOT NULL;

  result.duplicates := total_count - unique_url_count;

  RETURN result;
END;
$$;

-- 授权
GRANT EXECUTE ON FUNCTION get_collection_stats(uuid) TO authenticated;

-- 添加注释
COMMENT ON FUNCTION get_collection_stats(uuid) IS '获取收藏统计快照（总数、未分类、重复、无标签、长期未读），合并 6 个 COUNT 为 2 次高效查询';

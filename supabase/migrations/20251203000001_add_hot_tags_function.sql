-- 搜索页面性能优化：创建热门标签统计函数
-- 使用 SQL 聚合替代 JavaScript 遍历，提升性能

-- 创建获取用户热门标签的函数
CREATE OR REPLACE FUNCTION get_user_hot_tags(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  tag TEXT,
  count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    unnest(ai_tags) AS tag,
    COUNT(*) AS count
  FROM bookmarks
  WHERE
    user_id = p_user_id
    AND deleted_at IS NULL
    AND ai_tags IS NOT NULL
    AND array_length(ai_tags, 1) > 0
  GROUP BY tag
  ORDER BY count DESC
  LIMIT p_limit;
$$;

-- 添加函数注释
COMMENT ON FUNCTION get_user_hot_tags IS '获取用户热门标签统计，用于搜索页面显示';

-- 授予执行权限
GRANT EXECUTE ON FUNCTION get_user_hot_tags TO authenticated;

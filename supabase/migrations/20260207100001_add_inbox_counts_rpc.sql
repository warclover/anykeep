-- 收件箱计数 RPC 函数
-- 将 5 个独立的 COUNT 查询合并为 1 个 RPC 调用
-- 解决 N+1 查询性能问题
--
-- 优化效果：5 次数据库往返 → 1 次

-- 创建返回类型
DROP TYPE IF EXISTS inbox_counts_result CASCADE;
CREATE TYPE inbox_counts_result AS (
  uncategorized integer,
  unread integer,
  high_value integer,
  broken integer,
  recent integer
);

-- 创建 RPC 函数
CREATE OR REPLACE FUNCTION get_inbox_counts(p_user_id uuid)
RETURNS inbox_counts_result
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result inbox_counts_result;
  seven_days_ago timestamptz := now() - interval '7 days';
BEGIN
  -- 单次查询获取所有计数
  SELECT
    COUNT(*) FILTER (WHERE folder_id IS NULL),
    COUNT(*) FILTER (WHERE is_read = false),
    COUNT(*) FILTER (WHERE quality_score >= 0.7),
    COUNT(*) FILTER (WHERE link_status = 'broken'),
    COUNT(*) FILTER (WHERE created_at >= seven_days_ago)
  INTO
    result.uncategorized,
    result.unread,
    result.high_value,
    result.broken,
    result.recent
  FROM bookmarks
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
    AND is_in_trash = false;

  RETURN result;
END;
$$;

-- 授权
GRANT EXECUTE ON FUNCTION get_inbox_counts(uuid) TO authenticated;

-- 添加注释
COMMENT ON FUNCTION get_inbox_counts(uuid) IS '获取收件箱各 Tab 计数（待分类、未读、高价值、已失效、最近7天），合并 5 个 COUNT 为 1 次查询';

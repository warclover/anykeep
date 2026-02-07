-- 扩展收件箱计数 RPC 函数
-- 添加 processing（AI 处理中）字段
--
-- 新增统计项：
-- - processing: processing_status = 'processing' 或 'pending'

-- 更新返回类型
DROP TYPE IF EXISTS inbox_counts_result CASCADE;
CREATE TYPE inbox_counts_result AS (
  uncategorized integer,
  unread integer,
  high_value integer,
  broken integer,
  recent integer,
  processing integer
);

-- 更新 RPC 函数
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
    COUNT(*) FILTER (WHERE created_at >= seven_days_ago),
    COUNT(*) FILTER (WHERE processing_status IN ('processing', 'pending'))
  INTO
    result.uncategorized,
    result.unread,
    result.high_value,
    result.broken,
    result.recent,
    result.processing
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
COMMENT ON FUNCTION get_inbox_counts(uuid) IS '获取收件箱各 Tab 计数（待分类、未读、高价值、已失效、最近7天、AI处理中），合并 6 个 COUNT 为 1 次查询';

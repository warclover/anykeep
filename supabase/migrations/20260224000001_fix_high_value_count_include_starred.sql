-- 修复 get_inbox_counts RPC：高价值计数同时包含 is_starred=true 的书签
--
-- 问题：原函数仅统计 quality_score >= 0.7 的书签作为高价值计数，
--       但用户手动标星（is_starred=true）的书签也应归入高价值。
-- 修复：high_value 改为 is_starred = true OR quality_score >= 0.7

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
  SELECT
    COUNT(*) FILTER (WHERE folder_id IS NULL),
    COUNT(*) FILTER (WHERE is_read = false),
    COUNT(*) FILTER (WHERE is_starred = true OR quality_score >= 0.7),
    COUNT(*) FILTER (WHERE link_status = 'broken'),
    COUNT(*) FILTER (WHERE created_at >= seven_days_ago),
    0
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

GRANT EXECUTE ON FUNCTION get_inbox_counts(uuid) TO authenticated;

COMMENT ON FUNCTION get_inbox_counts(uuid) IS '获取整理中心各 Tab 计数。high_value：is_starred=true 或 quality_score>=0.7（二者满足其一即可）';

-- ============================================
-- 修复 get_health_overview 函数中的列引用歧义
-- ============================================
-- 问题: "column reference \"last_checked_at\" is ambiguous"
-- 原因: 返回列名与表列名相同，需要使用表别名限定

CREATE OR REPLACE FUNCTION get_health_overview(p_user_id UUID)
RETURNS TABLE (
  broken_links_count BIGINT,
  duplicates_count BIGINT,
  stale_count BIGINT,
  total_issues BIGINT,
  last_checked_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE hcc.check_type = 'broken_link' AND hcc.status = 'issue') as broken_links_count,
    COUNT(*) FILTER (WHERE hcc.check_type = 'duplicate' AND hcc.status = 'issue') as duplicates_count,
    COUNT(*) FILTER (WHERE hcc.check_type = 'stale' AND hcc.status = 'issue') as stale_count,
    COUNT(*) FILTER (WHERE hcc.status = 'issue') as total_issues,
    MAX(hcc.last_checked_at) as last_checked_at
  FROM health_check_cache hcc
  WHERE hcc.user_id = p_user_id;
END;
$$;

COMMENT ON FUNCTION get_health_overview IS '获取用户健康检测概览统计 - 修复列引用歧义';

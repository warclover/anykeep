-- ============================================================================
-- 安全修复: 通知系统数据库函数添加身份校验
-- 日期: 2026-02-01
-- 问题: SECURITY DEFINER 函数未校验调用者身份，存在权限提升风险
-- ============================================================================

-- 6.1 获取未读计数（按优先级分组）- 添加身份校验
CREATE OR REPLACE FUNCTION get_notification_counts(p_user_id UUID)
RETURNS TABLE(priority VARCHAR, count BIGINT) AS $$
BEGIN
  -- 🔒 安全修复：强制校验调用者身份
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller identity mismatch';
  END IF;

  RETURN QUERY
  SELECT n.priority::VARCHAR, COUNT(*)::BIGINT
  FROM user_notifications n
  WHERE n.user_id = p_user_id AND n.status = 'unread'
  GROUP BY n.priority;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.2 获取未读总数 - 添加身份校验
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS BIGINT AS $$
BEGIN
  -- 🔒 安全修复：强制校验调用者身份
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller identity mismatch';
  END IF;

  RETURN (
    SELECT COUNT(*)::BIGINT
    FROM user_notifications
    WHERE user_id = p_user_id AND status = 'unread'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.3 批量标记已读 - 添加身份校验
CREATE OR REPLACE FUNCTION mark_notifications_read(p_user_id UUID, p_ids UUID[])
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- 🔒 安全修复：强制校验调用者身份
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller identity mismatch';
  END IF;

  UPDATE user_notifications
  SET status = 'read', read_at = NOW()
  WHERE user_id = p_user_id
    AND id = ANY(p_ids)
    AND status = 'unread';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.4 全部标记已读 - 添加身份校验
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- 🔒 安全修复：强制校验调用者身份
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller identity mismatch';
  END IF;

  UPDATE user_notifications
  SET status = 'read', read_at = NOW()
  WHERE user_id = p_user_id AND status = 'unread';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.6 获取分���通知列表 - 添加身份校验
CREATE OR REPLACE FUNCTION get_notifications_grouped(
  p_user_id UUID,
  p_status VARCHAR DEFAULT NULL,
  p_priority VARCHAR DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  type_code VARCHAR,
  channels TEXT[],
  priority VARCHAR,
  title VARCHAR,
  body TEXT,
  entity_type VARCHAR,
  entity_id TEXT,
  action_url VARCHAR,
  action_label VARCHAR,
  metadata JSONB,
  status VARCHAR,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  date_group VARCHAR
) AS $$
BEGIN
  -- 🔒 安全修复：强制校验调用者身份
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller identity mismatch';
  END IF;

  RETURN QUERY
  SELECT
    n.id,
    n.type_code,
    n.channels,
    n.priority::VARCHAR,
    n.title,
    n.body,
    n.entity_type,
    n.entity_id,
    n.action_url,
    n.action_label,
    n.metadata,
    n.status::VARCHAR,
    n.read_at,
    n.created_at,
    CASE
      WHEN n.created_at >= CURRENT_DATE THEN 'today'
      WHEN n.created_at >= CURRENT_DATE - INTERVAL '1 day' THEN 'yesterday'
      WHEN n.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 'this_week'
      ELSE 'earlier'
    END::VARCHAR as date_group
  FROM user_notifications n
  WHERE n.user_id = p_user_id
    AND (p_status IS NULL OR n.status = p_status)
    AND (p_priority IS NULL OR n.priority = p_priority)
  ORDER BY n.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 完成
-- ============================================================================

-- ============================================================================
-- 修复: 通知系统 RPC 函数签名 - 添加无参数重载版本
-- 日期: 2026-02-07
-- 问题: 前端调用 supabase.rpc("get_notification_counts") 不传参数，
--       但数据库函数签名要求 p_user_id UUID，导致 404
-- 方案: 创建无参数重载版本，内部使用 auth.uid() 自动获取用户 ID
-- ============================================================================

-- 1. get_notification_counts() - 无参数版本
CREATE OR REPLACE FUNCTION get_notification_counts()
RETURNS TABLE(priority VARCHAR, count BIGINT) AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: not authenticated';
  END IF;

  RETURN QUERY
  SELECT n.priority::VARCHAR, COUNT(*)::BIGINT
  FROM user_notifications n
  WHERE n.user_id = auth.uid() AND n.status = 'unread'
  GROUP BY n.priority;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. mark_notifications_read(p_ids) - 仅需通知 ID 数组
CREATE OR REPLACE FUNCTION mark_notifications_read(p_ids UUID[])
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: not authenticated';
  END IF;

  UPDATE user_notifications
  SET status = 'read', read_at = NOW()
  WHERE user_id = auth.uid()
    AND id = ANY(p_ids)
    AND status = 'unread';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. mark_all_notifications_read() - 无参数版本
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: not authenticated';
  END IF;

  UPDATE user_notifications
  SET status = 'read', read_at = NOW()
  WHERE user_id = auth.uid() AND status = 'unread';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 完成
-- ============================================================================

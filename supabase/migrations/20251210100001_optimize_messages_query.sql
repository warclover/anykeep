-- ================================================
-- 消息系统查询优化
-- 合并消息列表和总数查询为单个函数调用
-- ================================================

-- 创建合并的查询函数
CREATE OR REPLACE FUNCTION public.get_messages_with_count(
  p_user_id UUID,
  p_status VARCHAR DEFAULT NULL,  -- 筛选状态
  p_level VARCHAR DEFAULT NULL,   -- 筛选等级
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  -- 消息字段
  id BIGINT,
  type VARCHAR,
  level VARCHAR,
  title VARCHAR,
  content TEXT,
  action_url VARCHAR,
  action_label VARCHAR,
  status VARCHAR,
  priority SMALLINT,
  created_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  metadata JSONB,
  related_bookmark_id BIGINT,
  related_folder_id BIGINT,
  date_group VARCHAR,
  -- 统计字段（每行相同）
  total_count INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER;
BEGIN
  -- 先获取总数
  SELECT COUNT(*)::INTEGER INTO v_total
  FROM public.messages m
  WHERE m.user_id = p_user_id
    AND (p_status IS NULL OR m.status = p_status)
    AND (p_level IS NULL OR m.level = p_level);

  -- 返回消息列表（带总数）
  RETURN QUERY
  SELECT
    m.id,
    m.type,
    m.level,
    m.title,
    m.content,
    m.action_url,
    m.action_label,
    m.status,
    m.priority,
    m.created_at,
    m.read_at,
    m.metadata,
    m.related_bookmark_id,
    m.related_folder_id,
    CASE
      WHEN m.created_at::date = CURRENT_DATE THEN 'today'
      WHEN m.created_at::date = CURRENT_DATE - 1 THEN 'yesterday'
      WHEN m.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 'this_week'
      ELSE 'earlier'
    END::VARCHAR as date_group,
    v_total as total_count
  FROM public.messages m
  WHERE m.user_id = p_user_id
    AND (p_status IS NULL OR m.status = p_status)
    AND (p_level IS NULL OR m.level = p_level)
  ORDER BY m.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 授权执行权限
GRANT EXECUTE ON FUNCTION public.get_messages_with_count TO authenticated;

-- 添加注释
COMMENT ON FUNCTION public.get_messages_with_count IS '获取消息列表（含总数），单次查询返回消息和分页信息';

-- ================================================
-- 扩展消息类型支持 V4.2 新增类型
-- ================================================

-- 修改 type 约束以支持新类型
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_type_check;

ALTER TABLE public.messages ADD CONSTRAINT messages_type_check CHECK (type IN (
  -- 分类相关
  'classification_auto', 'classification_batch',
  'classification_suggest', 'classification_failed',
  -- 导入相关
  'import_complete', 'import_partial', 'import_failed',
  -- 批量操作
  'batch_move', 'batch_delete', 'batch_tag', 'batch_restore',
  -- 书签状态
  'bookmark_saved', 'bookmark_invalid', 'bookmark_expired',
  -- 文件夹操作
  'folder_created', 'folder_merged',
  -- V4.2 AI 文件夹进化
  'folder_auto_created', 'folder_auto_split',
  'folder_auto_merged', 'folder_auto_renamed',
  'folder_operation_undone', 'ai_evolution_report',
  -- 系统消息
  'system_announcement', 'system_maintenance', 'system_update',
  -- 配额相关
  'quota_warning', 'quota_critical', 'quota_exceeded',
  -- V4.2 成本监控
  'cost_warning', 'cost_critical', 'cost_daily_exceeded',
  -- 用户反馈
  'feedback_received', 'feedback_response',
  -- AI 处理
  'ai_summary_complete', 'ai_tags_complete', 'ai_processing_failed'
));

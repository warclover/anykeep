-- ============================================================================
-- 消息系统重构 V2: 统一通知系统
-- 日期: 2026-02-01
-- 说明: 替换旧的 messages 表，引入类型枚举表 + 统一通知表
-- ============================================================================

-- ============================================================================
-- 1. 通知类型枚举表
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_types (
  code VARCHAR(50) PRIMARY KEY,
  category VARCHAR(30) NOT NULL CHECK (category IN ('ai', 'system', 'user', 'billing')),
  label VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  color VARCHAR(20),
  default_channels TEXT[] DEFAULT ARRAY['inbox'],
  default_priority VARCHAR(20) DEFAULT 'normal' CHECK (default_priority IN ('silent', 'normal', 'important', 'critical')),
  deprecated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE notification_types IS '通知类型枚举表，支持动态扩展';
COMMENT ON COLUMN notification_types.code IS '类型编码，如 ai.classification.auto';
COMMENT ON COLUMN notification_types.category IS '分类：ai/system/user/billing';
COMMENT ON COLUMN notification_types.default_channels IS '默认通道：inbox/toast/modal/push';

-- ============================================================================
-- 2. 预填充通知类型
-- ============================================================================
INSERT INTO notification_types (code, category, label, icon, color, default_channels, default_priority) VALUES
  -- AI 处理类
  ('ai.classification.auto', 'ai', '自动分类完成', 'FolderOpen', 'blue', ARRAY['inbox'], 'silent'),
  ('ai.classification.batch', 'ai', '批量分类完成', 'FolderOpen', 'blue', ARRAY['inbox', 'toast'], 'normal'),
  ('ai.classification.failed', 'ai', '分类失败', 'AlertCircle', 'red', ARRAY['inbox', 'toast'], 'normal'),
  ('ai.summary.complete', 'ai', 'AI 摘要生成', 'Sparkles', 'purple', ARRAY['inbox'], 'silent'),
  ('ai.tags.complete', 'ai', 'AI 标签生成', 'Tags', 'purple', ARRAY['inbox'], 'silent'),
  ('ai.processing.failed', 'ai', 'AI 处理失败', 'AlertCircle', 'red', ARRAY['inbox', 'toast'], 'normal'),

  -- 导入类
  ('import.complete', 'system', '导入完成', 'Download', 'green', ARRAY['inbox', 'toast'], 'normal'),
  ('import.partial', 'system', '部分导入成功', 'AlertCircle', 'yellow', ARRAY['inbox', 'toast'], 'normal'),
  ('import.failed', 'system', '导入失败', 'XCircle', 'red', ARRAY['inbox', 'toast', 'modal'], 'important'),

  -- 文件夹操作类
  ('folder.created', 'user', '文件夹已创建', 'FolderPlus', 'blue', ARRAY['toast'], 'silent'),
  ('folder.auto_created', 'ai', 'AI 创建文件夹', 'FolderPlus', 'purple', ARRAY['inbox', 'toast'], 'normal'),
  ('folder.auto_split', 'ai', 'AI 拆分文件夹', 'FolderTree', 'purple', ARRAY['inbox', 'toast'], 'normal'),
  ('folder.auto_merged', 'ai', 'AI 合并文件夹', 'FolderSync', 'purple', ARRAY['inbox', 'toast'], 'normal'),
  ('folder.auto_renamed', 'ai', 'AI 重命名文件夹', 'FolderEdit', 'purple', ARRAY['inbox'], 'silent'),
  ('folder.merged', 'user', '文件夹已合并', 'FolderSync', 'blue', ARRAY['inbox'], 'silent'),
  ('folder.operation_undone', 'user', '文件夹操作已撤销', 'Undo', 'blue', ARRAY['toast'], 'silent'),

  -- 配额类
  ('quota.warning', 'billing', 'AI 配额预警', 'AlertTriangle', 'yellow', ARRAY['inbox', 'modal'], 'important'),
  ('quota.critical', 'billing', 'AI 配额紧急', 'AlertOctagon', 'red', ARRAY['inbox', 'modal'], 'critical'),
  ('quota.exceeded', 'billing', 'AI 配额已用尽', 'Ban', 'red', ARRAY['inbox', 'modal'], 'critical'),
  ('cost.daily_exceeded', 'billing', '日费用超限', 'DollarSign', 'red', ARRAY['inbox', 'modal'], 'important'),

  -- 系统类
  ('system.announcement', 'system', '系统公告', 'Megaphone', 'blue', ARRAY['inbox', 'modal'], 'important'),
  ('system.maintenance', 'system', '系统维护', 'Wrench', 'yellow', ARRAY['inbox', 'modal'], 'important'),
  ('system.update', 'system', '系统更新', 'RefreshCw', 'blue', ARRAY['inbox'], 'normal'),

  -- 批量操作类
  ('batch.move', 'user', '批量移动完成', 'FolderInput', 'blue', ARRAY['inbox', 'toast'], 'normal'),
  ('batch.delete', 'user', '批量删除完成', 'Trash2', 'red', ARRAY['toast'], 'silent'),
  ('batch.tag', 'user', '批量标签完成', 'Tags', 'blue', ARRAY['toast'], 'silent'),
  ('batch.restore', 'user', '批量恢复完成', 'RotateCcw', 'green', ARRAY['toast'], 'silent'),

  -- 书签状态类
  ('bookmark.saved', 'user', '书签已保存', 'Bookmark', 'green', ARRAY['toast'], 'silent'),
  ('bookmark.invalid', 'system', '书签链接失效', 'LinkBreak', 'yellow', ARRAY['inbox'], 'normal'),
  ('bookmark.expired', 'system', '书签内容过期', 'Clock', 'yellow', ARRAY['inbox'], 'normal'),

  -- Brain-Sync 复习类
  ('review.reminder', 'ai', '复习提醒', 'Brain', 'purple', ARRAY['inbox', 'toast'], 'normal'),
  ('review.complete', 'ai', '复习完成', 'CheckCircle', 'green', ARRAY['inbox'], 'silent'),

  -- 主题合成类
  ('synthesis.complete', 'ai', '主题合成完成', 'Layers', 'purple', ARRAY['inbox', 'toast'], 'normal'),
  ('synthesis.failed', 'ai', '主题合成失败', 'AlertCircle', 'red', ARRAY['inbox', 'toast'], 'normal'),

  -- 页面监控类
  ('monitor.content_changed', 'ai', '页面内容变化', 'Eye', 'blue', ARRAY['inbox', 'toast'], 'normal'),
  ('monitor.failed', 'system', '页面监控失败', 'EyeOff', 'red', ARRAY['inbox'], 'normal'),
  ('monitor.quota_reached', 'billing', '监控配额已达上限', 'AlertTriangle', 'yellow', ARRAY['inbox'], 'normal'),

  -- 用户反馈类
  ('feedback.received', 'system', '反馈已收到', 'MessageSquare', 'green', ARRAY['inbox'], 'silent'),
  ('feedback.response', 'system', '反馈已回复', 'MessageSquare', 'blue', ARRAY['inbox', 'toast'], 'normal'),

  -- AI 进化报告类
  ('ai.evolution_report', 'ai', 'AI 进化报告', 'TrendingUp', 'purple', ARRAY['inbox'], 'normal')

ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 3. 统一通知表
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 类型引用
  type_code VARCHAR(50) NOT NULL REFERENCES notification_types(code),

  -- 通道与优先级（可覆盖默认值）
  channels TEXT[] NOT NULL,
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('silent', 'normal', 'important', 'critical')),

  -- 内容
  title VARCHAR(200) NOT NULL,
  body TEXT,

  -- 关联实体（多态引用）
  entity_type VARCHAR(30),
  entity_id TEXT,

  -- 操作
  action_url VARCHAR(500),
  action_label VARCHAR(50),

  -- 元数据
  metadata JSONB DEFAULT '{}',

  -- 状态
  status VARCHAR(20) DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
  read_at TIMESTAMPTZ,

  -- 时间
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

COMMENT ON TABLE user_notifications IS '统一通知表，替代旧的 messages 表';
COMMENT ON COLUMN user_notifications.channels IS '通知通道：inbox/toast/modal/push';
COMMENT ON COLUMN user_notifications.entity_type IS '关联实体类型：bookmark/folder/import';
COMMENT ON COLUMN user_notifications.metadata IS '扩展元���据，存储额外信息';

-- ============================================================================
-- 4. 索引优化
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_notifications_user_status
  ON user_notifications(user_id, status);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON user_notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_priority
  ON user_notifications(user_id, priority)
  WHERE status = 'unread';

CREATE INDEX IF NOT EXISTS idx_notifications_expires
  ON user_notifications(expires_at)
  WHERE status != 'archived';

CREATE INDEX IF NOT EXISTS idx_notifications_entity
  ON user_notifications(entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

-- ============================================================================
-- 5. RLS 策略
-- ============================================================================
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_notifications" ON user_notifications;
CREATE POLICY "users_own_notifications" ON user_notifications
  FOR ALL USING (auth.uid() = user_id);

-- notification_types 表对所有认证用户只读
ALTER TABLE notification_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_types_read_only" ON notification_types;
CREATE POLICY "notification_types_read_only" ON notification_types
  FOR SELECT USING (true);

-- ============================================================================
-- 6. 数据库函数
-- ============================================================================

-- 6.1 获取未读计数（按优先级分组）
CREATE OR REPLACE FUNCTION get_notification_counts(p_user_id UUID)
RETURNS TABLE(priority VARCHAR, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT n.priority::VARCHAR, COUNT(*)::BIGINT
  FROM user_notifications n
  WHERE n.user_id = p_user_id AND n.status = 'unread'
  GROUP BY n.priority;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.2 获取未读总数
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS BIGINT AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::BIGINT
    FROM user_notifications
    WHERE user_id = p_user_id AND status = 'unread'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.3 批量标记已读
CREATE OR REPLACE FUNCTION mark_notifications_read(p_user_id UUID, p_ids UUID[])
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE user_notifications
  SET status = 'read', read_at = NOW()
  WHERE user_id = p_user_id
    AND id = ANY(p_ids)
    AND status = 'unread';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.4 全部标记已读
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE user_notifications
  SET status = 'read', read_at = NOW()
  WHERE user_id = p_user_id AND status = 'unread';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.5 清理过期通知
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_notifications
  WHERE expires_at < NOW() AND status != 'archived';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.6 获取分组通知列表
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
-- 7. 定时清理任务（需要 pg_cron 扩展）
-- ============================================================================
-- 注意：需要在 Supabase Dashboard 中启用 pg_cron 扩展
-- SELECT cron.schedule(
--   'cleanup-expired-notifications',
--   '0 3 * * *',  -- 每天凌晨 3 点
--   $$SELECT cleanup_expired_notifications()$$
-- );

-- ============================================================================
-- 8. ���除旧表（谨慎操作）
-- ============================================================================
-- 备份旧数据（可选）
-- CREATE TABLE IF NOT EXISTS messages_backup AS SELECT * FROM messages;

-- 删除旧表
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS notification_preferences CASCADE;

-- 删除旧函数
DROP FUNCTION IF EXISTS get_unread_message_counts(UUID);
DROP FUNCTION IF EXISTS mark_messages_read(UUID, BIGINT[]);
DROP FUNCTION IF EXISTS cleanup_expired_messages();
DROP FUNCTION IF EXISTS get_messages_grouped(UUID, VARCHAR, VARCHAR, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_messages_count(UUID, VARCHAR, VARCHAR);

-- ============================================================================
-- 完成
-- ============================================================================

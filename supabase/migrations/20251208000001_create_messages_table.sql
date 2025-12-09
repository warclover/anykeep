-- ================================================
-- 消息系统表设计 V2
-- 用于存储用户消息通知，支持分级、自动清理、日期分组
-- ================================================

-- ================================================
-- 1. 创建消息表 (messages)
-- ================================================

CREATE TABLE IF NOT EXISTS public.messages (
  -- 主键
  id BIGSERIAL PRIMARY KEY,

  -- 用户关联
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 消息类型（完整列表）
  type VARCHAR(30) NOT NULL CHECK (type IN (
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
    -- 系统消息
    'system_announcement', 'system_maintenance', 'system_update',
    -- 配额相关
    'quota_warning', 'quota_critical', 'quota_exceeded',
    -- 用户反馈
    'feedback_received', 'feedback_response',
    -- AI 处理
    'ai_summary_complete', 'ai_tags_complete', 'ai_processing_failed'
  )),

  -- 消息等级（用于快速筛选和视觉区分）
  level VARCHAR(20) NOT NULL DEFAULT 'silent' CHECK (level IN (
    'silent',     -- L1: 仅记录，不打扰
    'normal',     -- L2: Toast + 记录
    'important'   -- L3: Modal + Toast + 记录
  )),

  -- 消息内容
  title VARCHAR(200) NOT NULL,
  content TEXT,

  -- 关联实体（可选，用于跳转）
  related_bookmark_id BIGINT REFERENCES public.bookmarks(id) ON DELETE SET NULL,
  related_folder_id BIGINT REFERENCES public.folders(id) ON DELETE SET NULL,
  related_import_id BIGINT REFERENCES public.import_history(id) ON DELETE SET NULL,

  -- 操作链接
  action_url VARCHAR(500),
  action_label VARCHAR(50),

  -- 扩展元数据（JSON 存储灵活信息）
  metadata JSONB DEFAULT '{}'::jsonb,

  -- 消息状态
  status VARCHAR(20) NOT NULL DEFAULT 'unread' CHECK (status IN (
    'unread',
    'read',
    'archived'
  )),

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,

  -- 优先级（1-10，数值越大越重要）
  priority SMALLINT DEFAULT 1 CHECK (priority >= 1 AND priority <= 10),

  -- 过期时间（用于自动清理，默认30天后）
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- ================================================
-- 2. 创建索引
-- ================================================

-- 用户 + 状态复合索引（最常用查询：获取用户未读消息）
CREATE INDEX IF NOT EXISTS idx_messages_user_status
  ON public.messages(user_id, status);

-- 用户 + 等级索引（快速筛选重要消息）
CREATE INDEX IF NOT EXISTS idx_messages_user_level
  ON public.messages(user_id, level);

-- 用户 + 创建时间索引（消息列表排序）
CREATE INDEX IF NOT EXISTS idx_messages_user_created
  ON public.messages(user_id, created_at DESC);

-- 用户 + 类型索引（按类型筛选）
CREATE INDEX IF NOT EXISTS idx_messages_user_type
  ON public.messages(user_id, type);

-- 过期时间索引（用于清理任务，只索引非归档消息）
CREATE INDEX IF NOT EXISTS idx_messages_expires
  ON public.messages(expires_at)
  WHERE status != 'archived';

-- 关联书签索引（部分索引，只索引非空值）
CREATE INDEX IF NOT EXISTS idx_messages_bookmark
  ON public.messages(related_bookmark_id)
  WHERE related_bookmark_id IS NOT NULL;

-- ================================================
-- 3. 启用 RLS 并创建策略
-- ================================================

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 查看自己的消息
CREATE POLICY "Users can view own messages"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 创建自己的消息（服务端也可以通过 service_role 创建）
CREATE POLICY "Users can create own messages"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 更新自己的消息（标记已读、归档等）
CREATE POLICY "Users can update own messages"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- 删除自己的消息
CREATE POLICY "Users can delete own messages"
  ON public.messages
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ================================================
-- 4. 添加表和列注释
-- ================================================

COMMENT ON TABLE public.messages IS '用户消息通知表 V2，支持分级、自动清理、日期分组';
COMMENT ON COLUMN public.messages.type IS '消息类型，共27种';
COMMENT ON COLUMN public.messages.level IS '消息等级：silent(仅记录)/normal(Toast)/important(Modal)';
COMMENT ON COLUMN public.messages.title IS '消息标题（简短描述，最多200字符）';
COMMENT ON COLUMN public.messages.content IS '消息详细内容（可选）';
COMMENT ON COLUMN public.messages.action_url IS '操作跳转URL';
COMMENT ON COLUMN public.messages.action_label IS '操作按钮文案';
COMMENT ON COLUMN public.messages.metadata IS '扩展元数据（JSON格式）';
COMMENT ON COLUMN public.messages.status IS '消息状态：unread/read/archived';
COMMENT ON COLUMN public.messages.priority IS '优先级：1-3静默，4-6普通，7-10重要';
COMMENT ON COLUMN public.messages.expires_at IS '过期时间，默认30天后自动清理';

-- ================================================
-- 5. 创建用户通知偏好表（预留）
-- ================================================

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- 各等级是否启用 Toast
  silent_toast BOOLEAN DEFAULT false,
  normal_toast BOOLEAN DEFAULT true,
  important_toast BOOLEAN DEFAULT true,

  -- 是否启用 Web Push（预留）
  web_push_enabled BOOLEAN DEFAULT false,
  web_push_subscription JSONB,  -- 存储 PushSubscription 对象

  -- 勿扰模式（预留）
  do_not_disturb BOOLEAN DEFAULT false,
  dnd_start_time TIME,  -- 勿扰开始时间
  dnd_end_time TIME,    -- 勿扰结束时间

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 策略
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notification preferences"
  ON public.notification_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.notification_preferences IS '用户通知偏好设置（预留）';

-- ================================================
-- 6. 创建数据库函数
-- ================================================

-- 6.1 获取未读消息数量（分等级统计）
CREATE OR REPLACE FUNCTION public.get_unread_message_counts(p_user_id UUID)
RETURNS TABLE (
  total INTEGER,
  silent INTEGER,
  normal INTEGER,
  important INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COUNT(*)::INTEGER as total,
    COUNT(*) FILTER (WHERE level = 'silent')::INTEGER as silent,
    COUNT(*) FILTER (WHERE level = 'normal')::INTEGER as normal,
    COUNT(*) FILTER (WHERE level = 'important')::INTEGER as important
  FROM public.messages
  WHERE user_id = p_user_id
    AND status = 'unread';
$$;

-- 6.2 批量标记已读
CREATE OR REPLACE FUNCTION public.mark_messages_read(
  p_user_id UUID,
  p_message_ids BIGINT[] DEFAULT NULL  -- NULL 表示全部标记已读
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  IF p_message_ids IS NULL THEN
    -- 标记所有未读消息为已读
    UPDATE public.messages
    SET status = 'read', read_at = NOW()
    WHERE user_id = p_user_id AND status = 'unread';
  ELSE
    -- 标记指定消息为已读
    UPDATE public.messages
    SET status = 'read', read_at = NOW()
    WHERE user_id = p_user_id
      AND id = ANY(p_message_ids)
      AND status = 'unread';
  END IF;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

-- 6.3 清理过期消息（定时任务调用）
CREATE OR REPLACE FUNCTION public.cleanup_expired_messages()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- 删除过期且未归档的消息
  DELETE FROM public.messages
  WHERE expires_at < NOW()
    AND status != 'archived';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- 6.4 获取消息列表（带日期分组）
CREATE OR REPLACE FUNCTION public.get_messages_grouped(
  p_user_id UUID,
  p_status VARCHAR DEFAULT NULL,  -- 筛选状态
  p_level VARCHAR DEFAULT NULL,   -- 筛选等级
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
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
  date_group VARCHAR  -- 'today' | 'yesterday' | 'this_week' | 'earlier'
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
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
    END as date_group
  FROM public.messages m
  WHERE m.user_id = p_user_id
    AND (p_status IS NULL OR m.status = p_status)
    AND (p_level IS NULL OR m.level = p_level)
  ORDER BY m.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- 6.5 获取消息总数（用于分页）
CREATE OR REPLACE FUNCTION public.get_messages_count(
  p_user_id UUID,
  p_status VARCHAR DEFAULT NULL,
  p_level VARCHAR DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.messages m
  WHERE m.user_id = p_user_id
    AND (p_status IS NULL OR m.status = p_status)
    AND (p_level IS NULL OR m.level = p_level);
$$;

-- ================================================
-- 7. 授权函数执行权限
-- ================================================

GRANT EXECUTE ON FUNCTION public.get_unread_message_counts TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_messages_read TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_messages TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_messages_grouped TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_messages_count TO authenticated;

-- ================================================
-- 8. 创建定时清理任务（如果 pg_cron 已启用）
-- ================================================

-- 注意：需要在 Supabase Dashboard 中启用 pg_cron 扩展
-- 每天凌晨 3 点执行清理过期消息
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- 检查是否已存在该任务
    IF NOT EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'cleanup_expired_messages'
    ) THEN
      PERFORM cron.schedule(
        'cleanup_expired_messages',
        '0 3 * * *',  -- 每天凌晨 3 点
        $$SELECT public.cleanup_expired_messages()$$
      );
    END IF;
  END IF;
END;
$$;

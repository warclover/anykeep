-- AI Skills Infrastructure Tables
-- Phase 0: 为 AI Skills 架构提供数据库支持
--
-- 新增表：
-- 1. ai_conversations - AI 会话管理
-- 2. ai_messages - AI 消息存储
-- 3. ai_skill_executions - Skill 执行日志
-- 4. ai_skill_versions - Skill 版本配置

-- ================================================
-- 1. AI 会话表 (ai_conversations)
-- ================================================
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  -- agent 类型：knowledge (知识助手), organize (整理助手), learn (学习助手)
  agent_type TEXT NOT NULL DEFAULT 'knowledge',
  -- 关联的书签 ID 列表
  context_bookmark_ids BIGINT[] DEFAULT '{}',
  -- 关联的文件夹 ID
  context_folder_id BIGINT REFERENCES public.folders(id) ON DELETE SET NULL,
  -- 会话元数据
  metadata JSONB DEFAULT '{}',
  -- 会话状态：active, archived, deleted
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  -- 消息计数（用于快速查询）
  message_count INT NOT NULL DEFAULT 0,
  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id
  ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_at
  ON ai_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_status
  ON ai_conversations(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_ai_conversations_agent_type
  ON ai_conversations(agent_type);

-- 更新时间触发器
CREATE OR REPLACE FUNCTION update_ai_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_conversations_updated_at ON ai_conversations;
CREATE TRIGGER ai_conversations_updated_at
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_conversations_updated_at();

-- ================================================
-- 2. AI 消息表 (ai_messages)
-- ================================================
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  -- 角色：user, assistant, system, tool
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  -- 消息内容
  content TEXT,
  -- Tool Calling 相关
  tool_calls JSONB,        -- AI 发起的工具调用
  tool_results JSONB,      -- 工具执行结果
  tool_call_id TEXT,       -- 关联的 tool call ID (用于 tool role)
  -- 消息元数据
  metadata JSONB DEFAULT '{}',
  -- Token 统计
  tokens_prompt INT DEFAULT 0,
  tokens_completion INT DEFAULT 0,
  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id
  ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at
  ON ai_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_messages_role
  ON ai_messages(role);

-- 消息计数触发器
CREATE OR REPLACE FUNCTION update_conversation_message_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE ai_conversations
    SET message_count = message_count + 1,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE ai_conversations
    SET message_count = message_count - 1,
        updated_at = NOW()
    WHERE id = OLD.conversation_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_messages_count_trigger ON ai_messages;
CREATE TRIGGER ai_messages_count_trigger
  AFTER INSERT OR DELETE ON ai_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_message_count();

-- ================================================
-- 3. Skill 执行日志表 (ai_skill_executions)
-- ================================================
CREATE TABLE IF NOT EXISTS public.ai_skill_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES ai_messages(id) ON DELETE SET NULL,
  -- Skill 信息
  skill_id TEXT NOT NULL,
  skill_version TEXT NOT NULL DEFAULT '1.0.0',
  -- 执行输入输出
  input JSONB NOT NULL,
  output JSONB,
  -- 执行状态：pending, running, success, error, timeout, cancelled
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'running', 'success', 'error', 'timeout', 'cancelled')
  ),
  -- 性能指标
  latency_ms INT,
  tokens_used INT DEFAULT 0,
  -- 错误信息
  error_message TEXT,
  error_code TEXT,
  -- 重试信息
  retry_count INT DEFAULT 0,
  -- 时间戳
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ai_skill_executions_user_id
  ON ai_skill_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_skill_executions_skill_id
  ON ai_skill_executions(skill_id);
CREATE INDEX IF NOT EXISTS idx_ai_skill_executions_status
  ON ai_skill_executions(status);
CREATE INDEX IF NOT EXISTS idx_ai_skill_executions_created_at
  ON ai_skill_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_skill_executions_conversation
  ON ai_skill_executions(conversation_id) WHERE conversation_id IS NOT NULL;

-- ================================================
-- 4. Skill 版本配置表 (ai_skill_versions)
-- ================================================
CREATE TABLE IF NOT EXISTS public.ai_skill_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Skill 标识
  skill_id TEXT NOT NULL,
  version TEXT NOT NULL,
  -- Skill 元数据
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('understanding', 'organizing', 'learning', 'utility')),
  -- 配置
  config JSONB NOT NULL DEFAULT '{}',
  -- 状态
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_deprecated BOOLEAN NOT NULL DEFAULT false,
  -- 使用统计
  execution_count BIGINT DEFAULT 0,
  success_count BIGINT DEFAULT 0,
  error_count BIGINT DEFAULT 0,
  avg_latency_ms FLOAT,
  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 唯一约束
  UNIQUE (skill_id, version)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ai_skill_versions_skill_id
  ON ai_skill_versions(skill_id);
CREATE INDEX IF NOT EXISTS idx_ai_skill_versions_active
  ON ai_skill_versions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ai_skill_versions_category
  ON ai_skill_versions(category);

-- 更新时间触发器
DROP TRIGGER IF EXISTS ai_skill_versions_updated_at ON ai_skill_versions;
CREATE TRIGGER ai_skill_versions_updated_at
  BEFORE UPDATE ON ai_skill_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_conversations_updated_at();

-- ================================================
-- 5. 启用 RLS
-- ================================================
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_skill_executions ENABLE ROW LEVEL SECURITY;
-- ai_skill_versions 是全局配置表，不需要 RLS

-- ================================================
-- 6. RLS 策略
-- ================================================

-- ai_conversations: 用户只能访问自己的会话
DROP POLICY IF EXISTS "Users can manage own conversations" ON ai_conversations;
CREATE POLICY "Users can manage own conversations"
  ON ai_conversations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ai_messages: 用户只能访问自己会话中的消息
DROP POLICY IF EXISTS "Users can view own conversation messages" ON ai_messages;
CREATE POLICY "Users can view own conversation messages"
  ON ai_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM ai_conversations WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own conversation messages" ON ai_messages;
CREATE POLICY "Users can insert own conversation messages"
  ON ai_messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM ai_conversations WHERE user_id = auth.uid()
    )
  );

-- ai_skill_executions: 用户只能查看自己的执行记录
DROP POLICY IF EXISTS "Users can view own skill executions" ON ai_skill_executions;
CREATE POLICY "Users can view own skill executions"
  ON ai_skill_executions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own skill executions" ON ai_skill_executions;
CREATE POLICY "Users can insert own skill executions"
  ON ai_skill_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ================================================
-- 7. 辅助函数
-- ================================================

-- 获取用户的 AI 使用统计
CREATE OR REPLACE FUNCTION get_user_ai_stats(p_user_id UUID, p_days INT DEFAULT 30)
RETURNS TABLE (
  total_conversations BIGINT,
  total_messages BIGINT,
  total_skill_executions BIGINT,
  total_tokens_used BIGINT,
  avg_latency_ms FLOAT,
  success_rate FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM ai_conversations WHERE user_id = p_user_id AND created_at > NOW() - (p_days || ' days')::INTERVAL),
    (SELECT COUNT(*) FROM ai_messages m
     JOIN ai_conversations c ON m.conversation_id = c.id
     WHERE c.user_id = p_user_id AND m.created_at > NOW() - (p_days || ' days')::INTERVAL),
    (SELECT COUNT(*) FROM ai_skill_executions WHERE user_id = p_user_id AND created_at > NOW() - (p_days || ' days')::INTERVAL),
    COALESCE((SELECT SUM(tokens_used) FROM ai_skill_executions WHERE user_id = p_user_id AND created_at > NOW() - (p_days || ' days')::INTERVAL), 0),
    (SELECT AVG(latency_ms) FROM ai_skill_executions WHERE user_id = p_user_id AND status = 'success' AND created_at > NOW() - (p_days || ' days')::INTERVAL),
    (SELECT
      CASE
        WHEN COUNT(*) = 0 THEN 0
        ELSE COUNT(*) FILTER (WHERE status = 'success')::FLOAT / COUNT(*)::FLOAT
      END
     FROM ai_skill_executions WHERE user_id = p_user_id AND created_at > NOW() - (p_days || ' days')::INTERVAL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 清理过期的会话消息（可选，用于定期清理）
CREATE OR REPLACE FUNCTION cleanup_old_ai_messages(p_days INT DEFAULT 90)
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  -- 删除已归档或删除状态的老会话
  WITH deleted_conversations AS (
    DELETE FROM ai_conversations
    WHERE status IN ('archived', 'deleted')
      AND updated_at < NOW() - (p_days || ' days')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted_conversations;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- 8. 注释
-- ================================================
COMMENT ON TABLE ai_conversations IS 'AI 会话表，存储用户与 AI 助手的对话会话';
COMMENT ON TABLE ai_messages IS 'AI 消息表，存储会话中的消息记录';
COMMENT ON TABLE ai_skill_executions IS 'Skill 执行日志表，记录所有 Skill 的执行历史';
COMMENT ON TABLE ai_skill_versions IS 'Skill 版本配置表，管理 Skill 的版本和配置';

COMMENT ON COLUMN ai_conversations.agent_type IS 'Agent 类型：knowledge (知识助手), organize (整理助手), learn (学习助手)';
COMMENT ON COLUMN ai_conversations.context_bookmark_ids IS '会话关联的书签 ID 列表';
COMMENT ON COLUMN ai_messages.tool_calls IS 'AI 发起的工具调用请求';
COMMENT ON COLUMN ai_messages.tool_results IS '工具执行的结果';
COMMENT ON COLUMN ai_skill_executions.skill_id IS 'Skill 唯一标识符，如 search, classify, summarize';

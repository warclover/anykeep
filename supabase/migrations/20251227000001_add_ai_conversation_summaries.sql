-- ============================================================================
-- 会话摘要表 - 存储每次对话的摘要和关键信息（情景记忆）
-- Migration: 20251227000001_add_ai_conversation_summaries
-- Author: Winston (Architect Agent)
-- Date: 2025-12-27
-- ============================================================================

-- 创建会话摘要表
CREATE TABLE IF NOT EXISTS ai_conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,

  -- 摘要内容
  summary TEXT NOT NULL,

  -- 用户意图关键词 (用于快速检索)
  intents TEXT[] DEFAULT '{}',

  -- 执行的重要操作
  -- 格式: [{ "type": "organize", "target": "B站视频", "outcome": "success" }]
  actions JSONB DEFAULT '[]',

  -- 学习到的用户偏好
  -- 格式: { "preferFolderOverTag": true, "defaultExportFormat": "markdown" }
  learned_preferences JSONB DEFAULT '{}',

  -- 未完成的意图 (用于下次提醒)
  pending_intents TEXT[] DEFAULT '{}',

  -- 消息数量 (用于判断会话深度)
  message_count INT DEFAULT 0,

  -- 会话情感基调
  sentiment TEXT DEFAULT 'neutral',

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 约束
  CONSTRAINT valid_sentiment CHECK (sentiment IN ('positive', 'negative', 'neutral', 'frustrated'))
);

-- ============================================================================
-- 索引
-- ============================================================================

-- 用户+时间索引 (查询最近摘要)
CREATE INDEX IF NOT EXISTS idx_ai_summaries_user_time
  ON ai_conversation_summaries(user_id, created_at DESC);

-- 意图关键词 GIN 索引 (全文搜索)
CREATE INDEX IF NOT EXISTS idx_ai_summaries_intents
  ON ai_conversation_summaries USING GIN(intents);

-- 未完成意图部分索引 (快速查找有待办的会话)
CREATE INDEX IF NOT EXISTS idx_ai_summaries_pending
  ON ai_conversation_summaries(user_id)
  WHERE array_length(pending_intents, 1) > 0;

-- ============================================================================
-- RLS 策略
-- ============================================================================

ALTER TABLE ai_conversation_summaries ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的摘要
CREATE POLICY "Users can view own summaries"
  ON ai_conversation_summaries FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能插入自己的摘要
CREATE POLICY "Users can insert own summaries"
  ON ai_conversation_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户只能删除自己的摘要
CREATE POLICY "Users can delete own summaries"
  ON ai_conversation_summaries FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 注释
-- ============================================================================

COMMENT ON TABLE ai_conversation_summaries IS '存储 AI 会话摘要，用于跨会话情景记忆';
COMMENT ON COLUMN ai_conversation_summaries.intents IS '会话中识别到的用户意图关键词';
COMMENT ON COLUMN ai_conversation_summaries.actions IS '会话中执行的重要操作记录';
COMMENT ON COLUMN ai_conversation_summaries.learned_preferences IS '从会话中学习到的用户偏好';
COMMENT ON COLUMN ai_conversation_summaries.pending_intents IS '用户提到但未执行的意图，下次可主动提醒';
COMMENT ON COLUMN ai_conversation_summaries.sentiment IS '会话情感基调: positive/negative/neutral/frustrated';

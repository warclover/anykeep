-- ============================================================================
-- 交互日志表 - 记录用户与 AI 的交互行为，用于偏好学习
-- Migration: 20251227000002_add_ai_interaction_logs
-- Author: Winston (Architect Agent)
-- Date: 2025-12-27
-- ============================================================================

-- 创建交互日志表
CREATE TABLE IF NOT EXISTS ai_interaction_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID,

  -- 交互类型
  -- 可选值: 'search', 'organize', 'export', 'delete', 'tag', 'move', 'undo', 'confirm', 'cancel', 'clarify'
  action_type TEXT NOT NULL,

  -- 操作目标描述
  -- 如: "B站视频", "前端相关收藏", "React文章"
  action_target TEXT,

  -- 用户反馈
  -- 可选值: 'positive' (接受), 'negative' (拒绝/撤销), 'modified' (修改后接受)
  user_feedback TEXT,

  -- AI 建议内容 (如有)
  -- 格式: { "suggestedFolder": "技术", "suggestedTags": ["React", "前端"] }
  ai_suggestion JSONB,

  -- 用户最终选择 (如有)
  -- 格式: { "chosenFolder": "编程", "chosenTags": ["React"] }
  user_choice JSONB,

  -- 上下文信息
  -- 格式: { "messageCount": 5, "confidence": 0.85 }
  context JSONB DEFAULT '{}',

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 约束
  CONSTRAINT valid_action_type CHECK (
    action_type IN ('search', 'organize', 'export', 'delete', 'tag', 'move', 'undo', 'confirm', 'cancel', 'clarify')
  ),
  CONSTRAINT valid_feedback CHECK (
    user_feedback IS NULL OR user_feedback IN ('positive', 'negative', 'modified')
  )
);

-- ============================================================================
-- 索引
-- ============================================================================

-- 用户+时间索引 (查询用户交互历史)
CREATE INDEX IF NOT EXISTS idx_ai_interactions_user_time
  ON ai_interaction_logs(user_id, created_at DESC);

-- 用户+操作类型索引 (分析常用操作)
CREATE INDEX IF NOT EXISTS idx_ai_interactions_user_type
  ON ai_interaction_logs(user_id, action_type);

-- 用户+反馈索引 (分析用户满意度)
CREATE INDEX IF NOT EXISTS idx_ai_interactions_user_feedback
  ON ai_interaction_logs(user_id, user_feedback)
  WHERE user_feedback IS NOT NULL;

-- 时间索引 (用于清理过期日志)
CREATE INDEX IF NOT EXISTS idx_ai_interactions_created_at
  ON ai_interaction_logs(created_at);

-- ============================================================================
-- RLS 策略
-- ============================================================================

ALTER TABLE ai_interaction_logs ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的日志
CREATE POLICY "Users can view own interaction logs"
  ON ai_interaction_logs FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能插入自己的日志
CREATE POLICY "Users can insert own interaction logs"
  ON ai_interaction_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 注释
-- ============================================================================

COMMENT ON TABLE ai_interaction_logs IS '记录用户与 AI 的交互行为，用于偏好学习和分析';
COMMENT ON COLUMN ai_interaction_logs.action_type IS '交互类型: search/organize/export/delete/tag/move/undo/confirm/cancel/clarify';
COMMENT ON COLUMN ai_interaction_logs.user_feedback IS '用户对 AI 建议的反馈: positive/negative/modified';
COMMENT ON COLUMN ai_interaction_logs.ai_suggestion IS 'AI 给出的建议内容';
COMMENT ON COLUMN ai_interaction_logs.user_choice IS '用户最终的选择（如果与 AI 建议不同）';

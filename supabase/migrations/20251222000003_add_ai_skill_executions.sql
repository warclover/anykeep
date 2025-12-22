-- AI Skill 执行日志表
-- 用于追踪 Skill 执行情况和性能监控

CREATE TABLE IF NOT EXISTS public.ai_skill_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  skill_id TEXT NOT NULL,
  skill_version TEXT NOT NULL,
  input JSONB NOT NULL,
  output JSONB,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'error', 'timeout')),
  latency_ms INT,
  tokens_used INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_executions_user ON ai_skill_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_executions_skill ON ai_skill_executions(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_executions_status ON ai_skill_executions(status);
CREATE INDEX IF NOT EXISTS idx_skill_executions_created ON ai_skill_executions(created_at DESC);

-- RLS
ALTER TABLE ai_skill_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own skill executions" ON ai_skill_executions;
CREATE POLICY "Users can view own skill executions"
  ON ai_skill_executions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own skill executions" ON ai_skill_executions;
CREATE POLICY "Users can insert own skill executions"
  ON ai_skill_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

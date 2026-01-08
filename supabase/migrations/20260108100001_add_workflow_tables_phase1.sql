-- =====================================================
-- 工作流系统 Phase 1: 核心表结构
-- 版本: 1.0.0
-- 日期: 2026-01-08
-- =====================================================

-- =====================================================
-- 工作流定义表
-- =====================================================
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  definition JSONB NOT NULL,
  category TEXT NOT NULL DEFAULT 'user_defined',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT workflows_category_check CHECK (category IN ('builtin', 'user_defined'))
);

-- 内置工作流 user_id 为 NULL
COMMENT ON TABLE workflows IS '工作流定义表，存储工作流配置';

-- =====================================================
-- 工作流执行记录表
-- =====================================================
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  trigger_context JSONB DEFAULT '{}'::jsonb,
  current_step_index INTEGER DEFAULT 0,
  step_results JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT workflow_executions_status_check CHECK (
    status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'waiting_confirmation')
  )
);

COMMENT ON TABLE workflow_executions IS '工作流执行记录表';

-- =====================================================
-- 索引
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_workflows_category ON workflows(category);
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_enabled ON workflows(enabled);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_id ON workflow_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_started_at ON workflow_executions(started_at DESC);

-- =====================================================
-- RLS 策略
-- =====================================================
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

-- 工作流：用户可访问自己的 + 内置的
CREATE POLICY "Users can view their own and builtin workflows"
  ON workflows FOR SELECT
  USING (auth.uid() = user_id OR category = 'builtin');

CREATE POLICY "Users can insert their own workflows"
  ON workflows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workflows"
  ON workflows FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workflows"
  ON workflows FOR DELETE
  USING (auth.uid() = user_id);

-- 执行记录：仅自己的
CREATE POLICY "Users can view their own executions"
  ON workflow_executions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own executions"
  ON workflow_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own executions"
  ON workflow_executions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own executions"
  ON workflow_executions FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 更新时间触发器
-- =====================================================
CREATE OR REPLACE FUNCTION update_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workflows_updated_at ON workflows;
CREATE TRIGGER workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_workflows_updated_at();

-- ============================================
-- User Workflows & Execution Logs
-- 用户工作流配置和执行日志表
-- ============================================

-- 1. 用户工作流配置表
CREATE TABLE user_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 基础信息
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT,              -- 'auto_classify' | 'periodic_cleanup' | 'expiry_reminder' | 'custom'
  enabled BOOLEAN DEFAULT true,

  -- 配置
  trigger_config JSONB NOT NULL,   -- 触发器配置
  condition_config JSONB,          -- 条件配置
  action_config JSONB NOT NULL,    -- 动作配置

  -- 执行统计
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 工作流执行日志表
CREATE TABLE workflow_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES user_workflows(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 执行信息
  status TEXT NOT NULL,            -- 'running' | 'success' | 'failed' | 'cancelled'
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,

  -- 结果
  items_processed INTEGER DEFAULT 0,
  items_affected INTEGER DEFAULT 0,
  error_message TEXT,
  execution_details JSONB,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX idx_user_workflows_user ON user_workflows(user_id);
CREATE INDEX idx_user_workflows_enabled ON user_workflows(user_id, enabled) WHERE enabled = true;
CREATE INDEX idx_user_workflows_template ON user_workflows(user_id, template_type);
CREATE INDEX idx_workflow_logs_workflow ON workflow_execution_logs(workflow_id, created_at DESC);
CREATE INDEX idx_workflow_logs_user ON workflow_execution_logs(user_id, created_at DESC);
CREATE INDEX idx_workflow_logs_status ON workflow_execution_logs(status) WHERE status = 'running';

-- RLS
ALTER TABLE user_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_execution_logs ENABLE ROW LEVEL SECURITY;

-- 用户可以管理自己的工作流
CREATE POLICY "Users manage own workflows" ON user_workflows
  FOR ALL USING (auth.uid() = user_id);

-- 用户可以查看自己的执行日志
CREATE POLICY "Users view own workflow logs" ON workflow_execution_logs
  FOR SELECT USING (auth.uid() = user_id);

-- 系统可以插入执行日志（通过 service role）
CREATE POLICY "System insert workflow logs" ON workflow_execution_logs
  FOR INSERT WITH CHECK (true);

-- 触发器：更新 updated_at
CREATE TRIGGER update_user_workflows_updated_at
  BEFORE UPDATE ON user_workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 注释
COMMENT ON TABLE user_workflows IS '用户自定义工作流配置';
COMMENT ON TABLE workflow_execution_logs IS '工作流执行日志';
COMMENT ON COLUMN user_workflows.template_type IS '模板类型：auto_classify=自动分类, periodic_cleanup=定期清理, expiry_reminder=到期提醒, custom=自定义';
COMMENT ON COLUMN user_workflows.trigger_config IS '触发器配置 JSON，包含触发类型和条件';
COMMENT ON COLUMN user_workflows.action_config IS '动作配置 JSON，定义工作流执行的操作';

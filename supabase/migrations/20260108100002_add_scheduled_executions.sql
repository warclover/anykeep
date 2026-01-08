-- =====================================================
-- 工作流系统 Phase 4: 定时执行记录表
-- 版本: 1.0.0
-- 日期: 2026-01-08
-- =====================================================

-- =====================================================
-- 定时执行记录表
-- =====================================================
CREATE TABLE IF NOT EXISTS scheduled_workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  execution_id UUID REFERENCES workflow_executions(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 索引
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_scheduled_executions_user ON scheduled_workflow_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_executions_status ON scheduled_workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_executions_scheduled_at ON scheduled_workflow_executions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_executions_pending ON scheduled_workflow_executions(status, scheduled_at)
  WHERE status = 'pending';

COMMENT ON TABLE scheduled_workflow_executions IS '定时工作流执行记录表';

-- =====================================================
-- RLS 策略
-- =====================================================
ALTER TABLE scheduled_workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scheduled executions"
  ON scheduled_workflow_executions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own scheduled executions"
  ON scheduled_workflow_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduled executions"
  ON scheduled_workflow_executions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scheduled executions"
  ON scheduled_workflow_executions FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 定时任务处理函数（供 pg_cron 或 Edge Function 调用）
-- =====================================================
CREATE OR REPLACE FUNCTION process_pending_scheduled_executions()
RETURNS INTEGER AS $$
DECLARE
  processed_count INTEGER := 0;
  pending_record RECORD;
BEGIN
  FOR pending_record IN
    SELECT id, workflow_id, user_id
    FROM scheduled_workflow_executions
    WHERE status = 'pending'
      AND scheduled_at <= NOW()
    ORDER BY scheduled_at
    LIMIT 50
    FOR UPDATE SKIP LOCKED
  LOOP
    -- 标记为运行中
    UPDATE scheduled_workflow_executions
    SET status = 'running', started_at = NOW()
    WHERE id = pending_record.id;

    processed_count := processed_count + 1;
  END LOOP;

  RETURN processed_count;
END;
$$ LANGUAGE plpgsql;

-- 文件: supabase/migrations/20251230000004_add_async_analysis.sql
-- 描述: Phase 4 - 异步分析
-- 版本: 1.0.0
-- 日期: 2025-12-30

-- ============================================================
-- 1. 创建异步分析任务表
-- ============================================================

CREATE TABLE IF NOT EXISTS async_analysis_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 任务类型
  type TEXT NOT NULL CHECK (type IN (
    'topic_clustering',
    'pattern_detection',
    'link_health_check',
    'global_insight_update',
    'duplicate_detection',
    'content_enrichment'
  )),

  -- 任务状态
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'cancelled'
  )),
  priority TEXT NOT NULL DEFAULT 'low' CHECK (priority IN ('low', 'medium', 'high')),
  trigger TEXT NOT NULL CHECK (trigger IN (
    'post_interaction', 'post_collection', 'scheduled', 'manual', 'on_visit'
  )),

  -- 输入输出
  input JSONB DEFAULT '{}',
  output JSONB,
  error TEXT,

  -- 重试信息
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- 添加表注释
COMMENT ON TABLE async_analysis_tasks IS 'Stores asynchronous analysis tasks for background processing';
COMMENT ON COLUMN async_analysis_tasks.type IS 'Type of analysis task';
COMMENT ON COLUMN async_analysis_tasks.status IS 'Current status of the task';
COMMENT ON COLUMN async_analysis_tasks.priority IS 'Task priority (high, medium, low)';
COMMENT ON COLUMN async_analysis_tasks.trigger IS 'What triggered this task';
COMMENT ON COLUMN async_analysis_tasks.input IS 'Input parameters for the task';
COMMENT ON COLUMN async_analysis_tasks.output IS 'Output results from the task';
COMMENT ON COLUMN async_analysis_tasks.error IS 'Error message if task failed';
COMMENT ON COLUMN async_analysis_tasks.retry_count IS 'Number of retry attempts';
COMMENT ON COLUMN async_analysis_tasks.max_retries IS 'Maximum allowed retries';
COMMENT ON COLUMN async_analysis_tasks.expires_at IS 'When the task expires if not completed';

-- 索引
CREATE INDEX idx_async_tasks_pending
  ON async_analysis_tasks(user_id, status, priority)
  WHERE status = 'pending';

CREATE INDEX idx_async_tasks_user_status
  ON async_analysis_tasks(user_id, status);

CREATE INDEX idx_async_tasks_expires
  ON async_analysis_tasks(expires_at)
  WHERE status = 'pending';

CREATE INDEX idx_async_tasks_type
  ON async_analysis_tasks(user_id, type, status);

-- RLS 策略
ALTER TABLE async_analysis_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks"
  ON async_analysis_tasks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own tasks"
  ON async_analysis_tasks FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 2. RPC 函数：获取待处理任务
-- ============================================================

CREATE OR REPLACE FUNCTION get_pending_analysis_tasks(
  p_user_id UUID,
  p_limit INT DEFAULT 10
)
RETURNS SETOF async_analysis_tasks
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM async_analysis_tasks
  WHERE user_id = p_user_id
    AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY
    CASE priority
      WHEN 'high' THEN 1
      WHEN 'medium' THEN 2
      WHEN 'low' THEN 3
    END,
    created_at
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_pending_analysis_tasks IS 'Gets pending analysis tasks for a user ordered by priority';

-- ============================================================
-- 3. RPC 函数：更新任务状态
-- ============================================================

CREATE OR REPLACE FUNCTION update_analysis_task_status(
  p_task_id UUID,
  p_status TEXT,
  p_output JSONB DEFAULT NULL,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE async_analysis_tasks
  SET
    status = p_status,
    output = COALESCE(p_output, output),
    error = p_error,
    started_at = CASE WHEN p_status = 'running' THEN NOW() ELSE started_at END,
    completed_at = CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE completed_at END
  WHERE id = p_task_id;
END;
$$;

COMMENT ON FUNCTION update_analysis_task_status IS 'Updates the status of an analysis task';

-- ============================================================
-- 4. RPC 函数：清理过期任务
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_expired_analysis_tasks()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INT;
BEGIN
  -- 删除过期的待处理任务
  DELETE FROM async_analysis_tasks
  WHERE status = 'pending'
    AND expires_at < NOW();

  -- 删除 7 天前的已完成任务
  DELETE FROM async_analysis_tasks
  WHERE status IN ('completed', 'failed', 'cancelled')
    AND completed_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_analysis_tasks IS 'Cleans up expired and old completed analysis tasks';

-- ============================================================
-- 5. RPC 函数：创建分析任务
-- ============================================================

CREATE OR REPLACE FUNCTION create_analysis_task(
  p_user_id UUID,
  p_type TEXT,
  p_trigger TEXT,
  p_priority TEXT DEFAULT 'low',
  p_input JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO async_analysis_tasks (user_id, type, trigger, priority, input)
  VALUES (p_user_id, p_type, p_trigger, p_priority, p_input)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

COMMENT ON FUNCTION create_analysis_task IS 'Creates a new analysis task';

-- ============================================================
-- 6. RPC 函数：获取用户任务统计
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_task_stats(
  p_user_id UUID
)
RETURNS TABLE (
  pending_count BIGINT,
  running_count BIGINT,
  completed_count BIGINT,
  failed_count BIGINT,
  by_type JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
    COUNT(*) FILTER (WHERE status = 'running') AS running_count,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
    jsonb_object_agg(type, type_count) AS by_type
  FROM async_analysis_tasks
  LEFT JOIN (
    SELECT type AS task_type, COUNT(*) AS type_count
    FROM async_analysis_tasks
    WHERE user_id = p_user_id
    GROUP BY type
  ) type_stats ON TRUE
  WHERE user_id = p_user_id;
END;
$$;

COMMENT ON FUNCTION get_user_task_stats IS 'Gets task statistics for a user';

-- ============================================================
-- 7. RPC 函数：取消任务
-- ============================================================

CREATE OR REPLACE FUNCTION cancel_analysis_task(
  p_task_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_exists BOOLEAN;
BEGIN
  UPDATE async_analysis_tasks
  SET status = 'cancelled'
  WHERE id = p_task_id
    AND status = 'pending'
  RETURNING TRUE INTO task_exists;

  RETURN COALESCE(task_exists, FALSE);
END;
$$;

COMMENT ON FUNCTION cancel_analysis_task IS 'Cancels a pending analysis task';

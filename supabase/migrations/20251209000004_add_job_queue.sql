-- =============================================================================
-- Migration: Add Job Queue for Async AI Operations (V4.2)
-- Description: 异步任务队列，用于 AI 文件夹进化操作
-- Version: V4.2 Phase 1.1.3
-- =============================================================================

-- 异步任务队列表
CREATE TABLE IF NOT EXISTS job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 任务类型与载荷
  type TEXT NOT NULL CHECK (type IN (
    'process_inbox_cache',      -- 处理待整理缓存池
    'check_rename_candidates',  -- 检查重命名候选
    'check_split_candidates',   -- 检查分拆候选
    'check_merge_candidates',   -- 检查合并候选
    'generate_monthly_report',  -- 生成月度报告
    'update_folder_profiles',   -- 更新文件夹画像
    'cleanup_expired_data'      -- 清理过期数据
  )),
  payload JSONB NOT NULL DEFAULT '{}',

  -- 优先级与调度
  priority INT DEFAULT 0,       -- 数值越大优先级越高
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),  -- 计划执行时间

  -- 执行状态
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',    -- 等待执行
    'claimed',    -- 已被领取
    'running',    -- 执行中
    'completed',  -- 已完成
    'failed',     -- 失败
    'cancelled'   -- 已取消
  )),

  -- 错误处理与重试
  error TEXT,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,

  -- 执行追踪
  result JSONB,                 -- 执行结果
  claimed_by TEXT,              -- 领取任务的 Worker ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- 防止重复执行的锁
  lock_until TIMESTAMPTZ
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_job_queue_pending
  ON job_queue(status, priority DESC, scheduled_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_job_queue_user
  ON job_queue(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_queue_type
  ON job_queue(type, status);

CREATE INDEX IF NOT EXISTS idx_job_queue_scheduled
  ON job_queue(scheduled_at)
  WHERE status = 'pending';

-- =============================================================================
-- RLS 策略
-- =============================================================================

ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;

-- 用户可以查看自己的任务
CREATE POLICY "Users can view own jobs"
  ON job_queue
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 用户可以创建自己的任务
CREATE POLICY "Users can create own jobs"
  ON job_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 用户可以取消自己的待执行任务
CREATE POLICY "Users can cancel own pending jobs"
  ON job_queue
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- 核心函数
-- =============================================================================

-- 原子性领取下一个任务（防止竞争条件）
CREATE OR REPLACE FUNCTION claim_next_job(
  p_worker_id TEXT,
  p_job_types TEXT[] DEFAULT NULL,
  p_lock_duration INTERVAL DEFAULT INTERVAL '5 minutes'
)
RETURNS TABLE (
  job_id UUID,
  job_type TEXT,
  job_payload JSONB,
  job_user_id UUID,
  job_attempts INT
) AS $$
DECLARE
  v_job RECORD;
BEGIN
  -- 使用 FOR UPDATE SKIP LOCKED 实现无锁并发
  SELECT j.id, j.type, j.payload, j.user_id, j.attempts
  INTO v_job
  FROM job_queue j
  WHERE j.status = 'pending'
    AND j.scheduled_at <= NOW()
    AND (j.lock_until IS NULL OR j.lock_until < NOW())
    AND (p_job_types IS NULL OR j.type = ANY(p_job_types))
  ORDER BY j.priority DESC, j.scheduled_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_job IS NULL THEN
    RETURN;
  END IF;

  -- 更新任务状态
  UPDATE job_queue
  SET
    status = 'claimed',
    claimed_by = p_worker_id,
    started_at = NOW(),
    attempts = attempts + 1,
    lock_until = NOW() + p_lock_duration
  WHERE id = v_job.id;

  -- 返回任务信息
  job_id := v_job.id;
  job_type := v_job.type;
  job_payload := v_job.payload;
  job_user_id := v_job.user_id;
  job_attempts := v_job.attempts + 1;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- 标记任务完成
CREATE OR REPLACE FUNCTION complete_job(
  p_job_id UUID,
  p_result JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE job_queue
  SET
    status = 'completed',
    result = p_result,
    completed_at = NOW(),
    lock_until = NULL
  WHERE id = p_job_id
    AND status IN ('claimed', 'running');

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 标记任务失败
CREATE OR REPLACE FUNCTION fail_job(
  p_job_id UUID,
  p_error TEXT,
  p_retry BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_job RECORD;
BEGIN
  SELECT attempts, max_attempts
  INTO v_job
  FROM job_queue
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 判断是否需要重试
  IF p_retry AND v_job.attempts < v_job.max_attempts THEN
    -- 重置为待执行状态，延迟重试
    UPDATE job_queue
    SET
      status = 'pending',
      error = p_error,
      lock_until = NULL,
      scheduled_at = NOW() + (INTERVAL '1 minute' * v_job.attempts)  -- 指数退避
    WHERE id = p_job_id;
  ELSE
    -- 标记为失败
    UPDATE job_queue
    SET
      status = 'failed',
      error = p_error,
      completed_at = NOW(),
      lock_until = NULL
    WHERE id = p_job_id;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 创建任务（便捷函数）
CREATE OR REPLACE FUNCTION enqueue_job(
  p_user_id UUID,
  p_type TEXT,
  p_payload JSONB DEFAULT '{}',
  p_priority INT DEFAULT 0,
  p_scheduled_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID AS $$
DECLARE
  v_job_id UUID;
BEGIN
  INSERT INTO job_queue (user_id, type, payload, priority, scheduled_at)
  VALUES (p_user_id, p_type, p_payload, p_priority, p_scheduled_at)
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

-- 检查是否有相同类型的待执行任务（防重复）
CREATE OR REPLACE FUNCTION has_pending_job(
  p_user_id UUID,
  p_type TEXT,
  p_payload_key TEXT DEFAULT NULL,
  p_payload_value TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_payload_key IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM job_queue
      WHERE user_id = p_user_id
        AND type = p_type
        AND status = 'pending'
        AND payload->>p_payload_key = p_payload_value
    );
  ELSE
    RETURN EXISTS (
      SELECT 1 FROM job_queue
      WHERE user_id = p_user_id
        AND type = p_type
        AND status = 'pending'
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 定时清理任务（需要 pg_cron 扩展）
-- =============================================================================

-- 清理 7 天前的已完成/失败任务
-- SELECT cron.schedule(
--   'cleanup-old-jobs',
--   '0 4 * * *',  -- 每天凌晨 4 点
--   $$DELETE FROM job_queue
--     WHERE status IN ('completed', 'failed', 'cancelled')
--     AND completed_at < NOW() - INTERVAL '7 days'$$
-- );

-- 重置卡住的任务（超过锁定时间仍未完成）
-- SELECT cron.schedule(
--   'reset-stuck-jobs',
--   '*/15 * * * *',  -- 每 15 分钟
--   $$UPDATE job_queue
--     SET status = 'pending', lock_until = NULL
--     WHERE status = 'claimed'
--     AND lock_until < NOW()$$
-- );

-- 添加注释说明
COMMENT ON TABLE job_queue IS 'AI 文件夹进化异步任务队列';
COMMENT ON COLUMN job_queue.type IS '任务类型';
COMMENT ON COLUMN job_queue.payload IS '任务载荷（JSON）';
COMMENT ON COLUMN job_queue.priority IS '优先级，数值越大越优先';
COMMENT ON COLUMN job_queue.lock_until IS '锁定截止时间，防止重复执行';

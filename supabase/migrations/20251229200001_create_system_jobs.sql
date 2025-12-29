-- Phase 2: 异步任务队列
-- 创建 system_jobs 表及相关函数

-- ============================================================================
-- 1. 枚举类型
-- ============================================================================

-- 任务类型枚举
DO $$ BEGIN
  CREATE TYPE job_type AS ENUM (
    'FETCH_METADATA',
    'GENERATE_EMBEDDING',
    'AUTO_CLASSIFY',
    'DEEP_CRAWL',
    'CLEANUP_TRASH',
    'VALIDATE_LINKS',
    'PROFILE_UPDATE',
    'BATCH_IMPORT',
    'SEND_NOTIFICATION'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 任务状态枚举
DO $$ BEGIN
  CREATE TYPE job_status AS ENUM (
    'PENDING',
    'RUNNING',
    'COMPLETED',
    'FAILED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. 任务表
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 任务信息
  type job_type NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',

  -- 状态管理
  status job_status NOT NULL DEFAULT 'PENDING',
  priority INT NOT NULL DEFAULT 10,  -- 1-100, 越小优先级越高

  -- 重试机制
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  last_error TEXT,

  -- 依赖关系
  depends_on UUID REFERENCES system_jobs(id) ON DELETE SET NULL,

  -- 所有者
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id INT REFERENCES bookmarks(id) ON DELETE CASCADE,

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ DEFAULT now(),  -- 延迟执行

  -- 锁机制 (防止并发消费)
  locked_by TEXT,
  locked_at TIMESTAMPTZ,

  -- 结果数据
  result JSONB
);

-- 添加注释
COMMENT ON TABLE system_jobs IS '异步任务队列表';
COMMENT ON COLUMN system_jobs.type IS '任务类型';
COMMENT ON COLUMN system_jobs.priority IS '优先级 1-100，越小优先级越高';
COMMENT ON COLUMN system_jobs.depends_on IS '依赖的前置任务 ID';
COMMENT ON COLUMN system_jobs.scheduled_for IS '计划执行时间，支持延迟任务';
COMMENT ON COLUMN system_jobs.locked_by IS 'Worker ID，用于防止并发消费';

-- ============================================================================
-- 3. 索引优化
-- ============================================================================

-- 待处理任务索引（核心查询优化）
CREATE INDEX IF NOT EXISTS idx_system_jobs_pending
  ON system_jobs (priority, scheduled_for)
  WHERE status = 'PENDING' AND locked_by IS NULL;

-- 用户任务查询索引
CREATE INDEX IF NOT EXISTS idx_system_jobs_user
  ON system_jobs (user_id, status, created_at DESC);

-- 书签关联任务索引
CREATE INDEX IF NOT EXISTS idx_system_jobs_bookmark
  ON system_jobs (bookmark_id, type);

-- 依赖关系索引
CREATE INDEX IF NOT EXISTS idx_system_jobs_depends_on
  ON system_jobs (depends_on)
  WHERE depends_on IS NOT NULL;

-- 过期锁清理索引
CREATE INDEX IF NOT EXISTS idx_system_jobs_stale_locks
  ON system_jobs (locked_at)
  WHERE locked_by IS NOT NULL AND status = 'RUNNING';

-- ============================================================================
-- 4. RPC 函数
-- ============================================================================

-- 获取并锁定待处理任务
CREATE OR REPLACE FUNCTION claim_next_job(
  p_worker_id TEXT,
  p_job_types job_type[] DEFAULT NULL,
  p_lock_duration INTERVAL DEFAULT INTERVAL '5 minutes'
)
RETURNS SETOF system_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 首先清理过期的锁
  UPDATE system_jobs
  SET
    locked_by = NULL,
    locked_at = NULL,
    status = 'PENDING'
  WHERE status = 'RUNNING'
    AND locked_at < now() - p_lock_duration;

  -- 获取并锁定任务
  RETURN QUERY
  WITH claimed AS (
    SELECT id
    FROM system_jobs
    WHERE status = 'PENDING'
      AND (p_job_types IS NULL OR type = ANY(p_job_types))
      AND locked_by IS NULL
      AND scheduled_for <= now()
      AND (depends_on IS NULL OR EXISTS (
        SELECT 1 FROM system_jobs dep
        WHERE dep.id = system_jobs.depends_on
          AND dep.status = 'COMPLETED'
      ))
    ORDER BY priority, created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE system_jobs
  SET
    locked_by = p_worker_id,
    locked_at = now(),
    status = 'RUNNING',
    started_at = COALESCE(started_at, now())
  FROM claimed
  WHERE system_jobs.id = claimed.id
  RETURNING system_jobs.*;
END;
$$;

-- 批量获取任务
CREATE OR REPLACE FUNCTION claim_jobs_batch(
  p_worker_id TEXT,
  p_job_types job_type[] DEFAULT NULL,
  p_limit INT DEFAULT 10,
  p_lock_duration INTERVAL DEFAULT INTERVAL '5 minutes'
)
RETURNS SETOF system_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 清理过期锁
  UPDATE system_jobs
  SET
    locked_by = NULL,
    locked_at = NULL,
    status = 'PENDING'
  WHERE status = 'RUNNING'
    AND locked_at < now() - p_lock_duration;

  -- 批量获取并锁定
  RETURN QUERY
  WITH claimed AS (
    SELECT id
    FROM system_jobs
    WHERE status = 'PENDING'
      AND (p_job_types IS NULL OR type = ANY(p_job_types))
      AND locked_by IS NULL
      AND scheduled_for <= now()
      AND (depends_on IS NULL OR EXISTS (
        SELECT 1 FROM system_jobs dep
        WHERE dep.id = system_jobs.depends_on
          AND dep.status = 'COMPLETED'
      ))
    ORDER BY priority, created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE system_jobs
  SET
    locked_by = p_worker_id,
    locked_at = now(),
    status = 'RUNNING',
    started_at = COALESCE(started_at, now())
  FROM claimed
  WHERE system_jobs.id = claimed.id
  RETURNING system_jobs.*;
END;
$$;

-- 完成任务
CREATE OR REPLACE FUNCTION complete_job(
  p_job_id UUID,
  p_success BOOLEAN,
  p_error TEXT DEFAULT NULL,
  p_result JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_success THEN
    UPDATE system_jobs
    SET
      status = 'COMPLETED',
      completed_at = now(),
      locked_by = NULL,
      locked_at = NULL,
      result = p_result
    WHERE id = p_job_id;
  ELSE
    UPDATE system_jobs
    SET
      status = CASE
        WHEN retry_count >= max_retries THEN 'FAILED'::job_status
        ELSE 'PENDING'::job_status
      END,
      retry_count = retry_count + 1,
      last_error = p_error,
      locked_by = NULL,
      locked_at = NULL,
      -- 指数退避：2^retry_count 分钟
      scheduled_for = now() + (power(2, retry_count) * interval '1 minute')
    WHERE id = p_job_id;
  END IF;
END;
$$;

-- 取消任务
CREATE OR REPLACE FUNCTION cancel_job(
  p_job_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_affected INT;
BEGIN
  UPDATE system_jobs
  SET
    status = 'CANCELLED',
    locked_by = NULL,
    locked_at = NULL,
    completed_at = now()
  WHERE id = p_job_id
    AND user_id = p_user_id
    AND status IN ('PENDING', 'RUNNING');

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RETURN v_affected > 0;
END;
$$;

-- 获取任务统计
CREATE OR REPLACE FUNCTION get_job_stats(
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  status job_status,
  count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT j.status, COUNT(*)::BIGINT
  FROM system_jobs j
  WHERE p_user_id IS NULL OR j.user_id = p_user_id
  GROUP BY j.status;
END;
$$;

-- 清理旧任务
CREATE OR REPLACE FUNCTION cleanup_old_jobs(
  p_retention_days INT DEFAULT 30
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM system_jobs
  WHERE status IN ('COMPLETED', 'FAILED', 'CANCELLED')
    AND completed_at < now() - (p_retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ============================================================================
-- 5. RLS 策略
-- ============================================================================

ALTER TABLE system_jobs ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（使迁移幂等）
DROP POLICY IF EXISTS "Users can view own jobs" ON system_jobs;
DROP POLICY IF EXISTS "Users can insert own jobs" ON system_jobs;
DROP POLICY IF EXISTS "Service role full access" ON system_jobs;

-- 用户只能查看自己的任务
CREATE POLICY "Users can view own jobs"
  ON system_jobs FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能插入自己的任务
CREATE POLICY "Users can insert own jobs"
  ON system_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 服务角色完全访问（用于 Worker）
CREATE POLICY "Service role full access"
  ON system_jobs FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- 6. 触发器：自动更新书签状态
-- ============================================================================

CREATE OR REPLACE FUNCTION update_bookmark_on_job_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 当任务完成时，更新书签状态
  IF NEW.status = 'COMPLETED' AND NEW.bookmark_id IS NOT NULL THEN
    -- 检查是否所有相关任务都完成
    IF NOT EXISTS (
      SELECT 1 FROM system_jobs
      WHERE bookmark_id = NEW.bookmark_id
        AND status NOT IN ('COMPLETED', 'CANCELLED', 'FAILED')
        AND id != NEW.id
    ) THEN
      UPDATE bookmarks
      SET
        status = 'COMPLETED',
        updated_at = now()
      WHERE id = NEW.bookmark_id
        AND status != 'COMPLETED';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_bookmark_on_job_complete ON system_jobs;
CREATE TRIGGER trg_update_bookmark_on_job_complete
  AFTER UPDATE ON system_jobs
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_bookmark_on_job_complete();

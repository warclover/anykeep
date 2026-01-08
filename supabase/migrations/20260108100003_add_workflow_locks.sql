-- =====================================================
-- 工作流系统 Phase 4: 分布式锁表
-- 版本: 1.0.0
-- 日期: 2026-01-08
-- =====================================================

-- =====================================================
-- 工作流锁表
-- =====================================================
CREATE TABLE IF NOT EXISTS workflow_locks (
  lock_key TEXT PRIMARY KEY,
  lock_id BIGINT NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  instance_id TEXT
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_workflow_locks_expires ON workflow_locks(expires_at);

COMMENT ON TABLE workflow_locks IS '分布式锁表，防止多实例重复执行';

-- =====================================================
-- 尝试获取锁函数
-- =====================================================
CREATE OR REPLACE FUNCTION try_acquire_workflow_lock(
  p_lock_id BIGINT,
  p_lock_key TEXT,
  p_ttl_ms INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_expires_at TIMESTAMPTZ;
  v_instance_id TEXT;
BEGIN
  v_expires_at := NOW() + (p_ttl_ms || ' milliseconds')::INTERVAL;
  v_instance_id := gen_random_uuid()::TEXT;

  -- 清理过期锁
  DELETE FROM workflow_locks WHERE expires_at < NOW();

  -- 尝试插入新锁
  BEGIN
    INSERT INTO workflow_locks (lock_key, lock_id, acquired_at, expires_at, instance_id)
    VALUES (p_lock_key, p_lock_id, NOW(), v_expires_at, v_instance_id);
    RETURN TRUE;
  EXCEPTION WHEN unique_violation THEN
    -- 锁已存在且未过期
    RETURN FALSE;
  END;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 释放锁函数
-- =====================================================
CREATE OR REPLACE FUNCTION release_workflow_lock(
  p_lock_id BIGINT,
  p_lock_key TEXT
)
RETURNS VOID AS $$
BEGIN
  DELETE FROM workflow_locks WHERE lock_key = p_lock_key;
END;
$$ LANGUAGE plpgsql;

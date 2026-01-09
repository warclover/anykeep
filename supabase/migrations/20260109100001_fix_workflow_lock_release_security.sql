-- =====================================================
-- 工作流系统安全修复: 分布式锁释放验证
-- 版本: 1.0.2
-- 日期: 2026-01-09
--
-- 安全问题: release_workflow_lock 未验证锁持有者身份
-- 修复方案: 添加 instance_id 验证
-- =====================================================

-- =====================================================
-- 步骤 1: 添加 instance_id 列（如果不存在）
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_locks' AND column_name = 'instance_id'
  ) THEN
    ALTER TABLE workflow_locks ADD COLUMN instance_id TEXT;
  END IF;
END $$;

-- =====================================================
-- 步骤 2: 删除旧函数（因为返回类型改变，必须先删除）
-- =====================================================
DROP FUNCTION IF EXISTS try_acquire_workflow_lock(BIGINT, TEXT, INTEGER);

-- =====================================================
-- 步骤 3: 更新释放锁函数 - 添加 instance_id 验证
-- =====================================================
CREATE OR REPLACE FUNCTION release_workflow_lock(
  p_lock_id BIGINT,
  p_lock_key TEXT,
  p_instance_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  -- 安全修复：验证锁持有者身份
  -- 如果提供了 instance_id，则必须匹配才能释放
  -- 如果未提供 instance_id（向后兼容），则只验证 lock_key 和 lock_id
  IF p_instance_id IS NOT NULL THEN
    DELETE FROM workflow_locks
    WHERE lock_key = p_lock_key
      AND lock_id = p_lock_id
      AND instance_id = p_instance_id;
  ELSE
    -- 向后兼容：旧代码不传 instance_id 时，仍然使用 lock_id 验证
    DELETE FROM workflow_locks
    WHERE lock_key = p_lock_key
      AND lock_id = p_lock_id;
  END IF;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 步骤 4: 重建获取锁函数 - 返回 instance_id 供后续释放使用
-- =====================================================
CREATE OR REPLACE FUNCTION try_acquire_workflow_lock(
  p_lock_id BIGINT,
  p_lock_key TEXT,
  p_ttl_ms INTEGER
)
RETURNS TEXT AS $$
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
    -- 返回 instance_id 供释放时使用
    RETURN v_instance_id;
  EXCEPTION WHEN unique_violation THEN
    -- 锁已存在且未过期
    RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 步骤 5: 添加注释
-- =====================================================
COMMENT ON FUNCTION release_workflow_lock(BIGINT, TEXT, TEXT) IS
  '安全释放工作流锁，验证 instance_id 防止误释放其他实例的锁';

COMMENT ON FUNCTION try_acquire_workflow_lock(BIGINT, TEXT, INTEGER) IS
  '尝试获取工作流锁，成功返回 instance_id，失败返回 NULL';

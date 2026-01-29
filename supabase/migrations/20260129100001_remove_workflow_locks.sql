-- =====================================================
-- 移除分布式锁相关资源
-- 版本: 1.0.0
-- 日期: 2026-01-29
--
-- 原因: Workflow 系统已简化，分布式锁不再需要
-- 替代方案: 使用状态位原子更新 (UPDATE ... WHERE status = 'pending')
-- =====================================================

-- 移除 RPC 函数
DROP FUNCTION IF EXISTS try_acquire_workflow_lock(BIGINT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS release_workflow_lock(BIGINT, TEXT, TEXT);
DROP FUNCTION IF EXISTS release_workflow_lock(BIGINT, TEXT);

-- 移除锁表
DROP TABLE IF EXISTS workflow_locks;

-- 添加注释说明
COMMENT ON TABLE scheduled_workflow_executions IS
  '定时任务执行表，使用 status 字段实现原子性抢占，无需额外分布式锁';

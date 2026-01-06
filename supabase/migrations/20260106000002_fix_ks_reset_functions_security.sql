-- ============================================================
-- Fix: Restrict reset functions to service_role only
-- HIGH-6: 添加数据库函数权限检查
-- ============================================================

-- Revoke public execute on reset functions
-- These should only be called by scheduled jobs (service_role)

REVOKE EXECUTE ON FUNCTION reset_ks_daily_counts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION reset_ks_weekly_counts() FROM PUBLIC;

-- Grant execute only to service_role (for cron jobs)
GRANT EXECUTE ON FUNCTION reset_ks_daily_counts() TO service_role;
GRANT EXECUTE ON FUNCTION reset_ks_weekly_counts() TO service_role;

-- Add comments explaining the security model
COMMENT ON FUNCTION reset_ks_daily_counts IS
  '重置每日计数 - 仅供定时任务调用 (service_role)';
COMMENT ON FUNCTION reset_ks_weekly_counts IS
  '重置每周计数 - 仅供定时任务调用 (service_role)';

-- =====================================================
-- 移除已废弃的 Edge Function 相关数据库对象
-- 版本: 1.0.0
-- 日期: 2026-03-09
--
-- 移除的 Edge Functions:
--   - check-page-changes (内容变更监控)
--   - validate-all-links (全链接验证)
--   - librarian-patrol (整理大师巡检)
--   - send-review-reminder (复习提醒)
--   - generate-weekly-queue (复习队列生成)
--   - workflow-scheduler (工作流调度)
-- =====================================================

-- 1. 移除 pg_cron 定时任务 (validate-all-links)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('validate-all-links');
    RAISE NOTICE 'Unscheduled cron job: validate-all-links';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not unschedule validate-all-links: %', SQLERRM;
END $$;

-- 2. 删除 validate-all-links 包装函数
DROP FUNCTION IF EXISTS invoke_validate_all_links();

-- 3. 删除 workflow 历史清理相关函数 (仅由 workflow-scheduler 使用)
DROP FUNCTION IF EXISTS cleanup_workflow_history_all();
DROP FUNCTION IF EXISTS cleanup_workflow_execution_history();
DROP FUNCTION IF EXISTS cleanup_orphaned_step_results();

-- 4. 删除 edge_function_rate_limits 表 (仅由 workflow-scheduler 使用)
DROP TABLE IF EXISTS edge_function_rate_limits CASCADE;

-- 5. 删除速率限制清理函数
DROP FUNCTION IF EXISTS cleanup_edge_function_rate_limits();

-- 验证清理结果
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'edge_function_rate_limits'
  ) THEN
    RAISE NOTICE 'Cleanup completed: edge_function_rate_limits table removed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'invoke_validate_all_links'
  ) THEN
    RAISE NOTICE 'Cleanup completed: invoke_validate_all_links function removed';
  END IF;
END $$;

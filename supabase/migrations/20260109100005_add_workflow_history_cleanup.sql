-- =====================================================
-- 工作流执行历史清理策略
-- 版本: 1.0.0
-- 日期: 2026-01-09
--
-- 功能:
-- 1. 自动清理超过 30 天的已完成执行记录
-- 2. 自动清理超过 7 天的失败执行记录
-- 3. 保留最近 100 条执行记录（无论时间）
-- =====================================================

-- 创建执行历史清理函数
CREATE OR REPLACE FUNCTION cleanup_workflow_execution_history()
RETURNS TABLE (
    deleted_completed integer,
    deleted_failed integer,
    retained_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    completed_deleted integer := 0;
    failed_deleted integer := 0;
    total_retained integer := 0;
BEGIN
    -- 步骤 1: 删除超过 30 天的已完成执行记录
    -- 但保留每个工作流最近 100 条记录
    WITH ranked_executions AS (
        SELECT
            id,
            workflow_id,
            status,
            created_at,
            ROW_NUMBER() OVER (
                PARTITION BY workflow_id
                ORDER BY created_at DESC
            ) as rn
        FROM workflow_executions
    ),
    to_delete_completed AS (
        SELECT id
        FROM ranked_executions
        WHERE status = 'completed'
          AND created_at < NOW() - INTERVAL '30 days'
          AND rn > 100  -- 保留最近 100 条
    )
    DELETE FROM workflow_executions
    WHERE id IN (SELECT id FROM to_delete_completed);

    GET DIAGNOSTICS completed_deleted = ROW_COUNT;

    -- 步骤 2: 删除超过 7 天的失败执行记录
    -- 但保留每个工作流最近 50 条失败记录（用于调试）
    WITH ranked_failed AS (
        SELECT
            id,
            workflow_id,
            status,
            created_at,
            ROW_NUMBER() OVER (
                PARTITION BY workflow_id
                ORDER BY created_at DESC
            ) as rn
        FROM workflow_executions
        WHERE status = 'failed'
    ),
    to_delete_failed AS (
        SELECT id
        FROM ranked_failed
        WHERE created_at < NOW() - INTERVAL '7 days'
          AND rn > 50  -- 保留最近 50 条失败记录
    )
    DELETE FROM workflow_executions
    WHERE id IN (SELECT id FROM to_delete_failed);

    GET DIAGNOSTICS failed_deleted = ROW_COUNT;

    -- 步骤 3: 统计保留的记录数
    SELECT COUNT(*) INTO total_retained FROM workflow_executions;

    RETURN QUERY SELECT completed_deleted, failed_deleted, total_retained;
END;
$$;

-- 创建清理步骤结果的函数（关联清理）
CREATE OR REPLACE FUNCTION cleanup_orphaned_step_results()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count integer;
BEGIN
    -- 删除已不存在执行记录的步骤结果
    DELETE FROM workflow_step_results
    WHERE execution_id NOT IN (
        SELECT id FROM workflow_executions
    );

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- 创建综合清理函数（供 Edge Function 或 pg_cron 调用）
CREATE OR REPLACE FUNCTION cleanup_workflow_history_all()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    exec_result RECORD;
    step_deleted integer;
    rate_limit_deleted integer;
BEGIN
    -- 1. 清理执行历史
    SELECT * INTO exec_result FROM cleanup_workflow_execution_history();

    -- 2. 清理孤立的步骤结果
    SELECT cleanup_orphaned_step_results() INTO step_deleted;

    -- 3. 清理速率限制记录
    SELECT cleanup_edge_function_rate_limits() INTO rate_limit_deleted;

    RETURN jsonb_build_object(
        'execution_history', jsonb_build_object(
            'completed_deleted', exec_result.deleted_completed,
            'failed_deleted', exec_result.deleted_failed,
            'retained', exec_result.retained_count
        ),
        'step_results_deleted', step_deleted,
        'rate_limits_deleted', rate_limit_deleted,
        'cleaned_at', NOW()
    );
END;
$$;

-- 添加注释
COMMENT ON FUNCTION cleanup_workflow_execution_history() IS '清理工作流执行历史记录';
COMMENT ON FUNCTION cleanup_orphaned_step_results() IS '清理孤立的步骤结果记录';
COMMENT ON FUNCTION cleanup_workflow_history_all() IS '综合清理函数，供定时任务调用';

-- 验证函数创建成功
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'cleanup_workflow_history_all'
    ) THEN
        RAISE NOTICE 'Workflow history cleanup functions created successfully';
    ELSE
        RAISE EXCEPTION 'Failed to create cleanup functions';
    END IF;
END $$;

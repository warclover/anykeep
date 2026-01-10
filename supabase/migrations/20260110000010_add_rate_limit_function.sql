-- ============================================
-- Code Review P0-2: 添加分布式速率限制支持
-- ============================================
-- 创建速率限制表和检查函数
-- 用于高风险端点（auth、dangerous、ai、batch）的分布式速率限制

-- 创建速率限制记录表
CREATE TABLE IF NOT EXISTS rate_limit_records (
    id BIGSERIAL PRIMARY KEY,
    identifier TEXT NOT NULL,
    config_key TEXT NOT NULL,
    request_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引以加速查询
CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier_config
    ON rate_limit_records (identifier, config_key, request_time);

-- 创建自动清理索引（用于过期记录）
CREATE INDEX IF NOT EXISTS idx_rate_limit_created_at
    ON rate_limit_records (created_at);

-- 创建速率限制检查函数（原子操作）
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_identifier TEXT,
    p_config_key TEXT,
    p_window_start TIMESTAMPTZ,
    p_max_requests INTEGER,
    p_window_ms BIGINT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
    v_oldest_time TIMESTAMPTZ;
    v_reset_ms BIGINT;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- 统计窗口内的请求数
    SELECT COUNT(*), MIN(request_time)
    INTO v_count, v_oldest_time
    FROM rate_limit_records
    WHERE identifier = p_identifier
      AND config_key = p_config_key
      AND request_time > p_window_start;

    -- 检查是否超限
    IF v_count >= p_max_requests THEN
        -- 计算重置时间
        v_reset_ms := EXTRACT(EPOCH FROM (v_oldest_time + (p_window_ms || ' milliseconds')::INTERVAL - v_now)) * 1000;
        IF v_reset_ms < 0 THEN
            v_reset_ms := 0;
        END IF;

        RETURN jsonb_build_object(
            'allowed', false,
            'remaining', 0,
            'reset_ms', v_reset_ms
        );
    END IF;

    -- 记录本次请求
    INSERT INTO rate_limit_records (identifier, config_key, request_time)
    VALUES (p_identifier, p_config_key, v_now);

    RETURN jsonb_build_object(
        'allowed', true,
        'remaining', p_max_requests - v_count - 1,
        'reset_ms', p_window_ms
    );
END;
$$;

-- 创建清理过期记录的函数
CREATE OR REPLACE FUNCTION cleanup_rate_limit_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 删除超过 2 小时的记录（最长窗口是 1 小时）
    DELETE FROM rate_limit_records
    WHERE created_at < NOW() - INTERVAL '2 hours';
END;
$$;

-- 使用 pg_cron 定期清理（每 30 分钟执行一次）
-- 注意：pg_cron 需要在 Supabase Dashboard 中手动启用
DO $$
BEGIN
    -- 检查 pg_cron 是否可用
    IF EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN
        -- 删除已存在的任务（如果有）
        PERFORM cron.unschedule('cleanup-rate-limit-records');

        -- 创建定时任务
        PERFORM cron.schedule(
            'cleanup-rate-limit-records',
            '*/30 * * * *',
            'SELECT cleanup_rate_limit_records()'
        );

        RAISE NOTICE 'pg_cron job scheduled for rate limit cleanup';
    ELSE
        RAISE NOTICE 'pg_cron not available, please manually clean up rate_limit_records table';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not schedule pg_cron job: %', SQLERRM;
END;
$$;

-- 添加 RLS 策略
ALTER TABLE rate_limit_records ENABLE ROW LEVEL SECURITY;

-- 仅允许服务角色访问（通过函数使用 SECURITY DEFINER）
CREATE POLICY "rate_limit_records_service_only" ON rate_limit_records
    FOR ALL
    USING (false)
    WITH CHECK (false);

-- 添加注释
COMMENT ON TABLE rate_limit_records IS '速率限制记录表（Code Review P0-2）';
COMMENT ON FUNCTION check_rate_limit IS '原子速率限制检查函数（Code Review P0-2）';
COMMENT ON FUNCTION cleanup_rate_limit_records IS '清理过期速率限制记录（Code Review P0-2）';

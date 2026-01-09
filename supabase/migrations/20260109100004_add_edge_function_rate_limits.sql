-- =====================================================
-- Edge Function 速率限制表
-- 版本: 1.0.0
-- 日期: 2026-01-09
--
-- 用途: 为 Edge Functions 提供数据库级别的速率限制
-- =====================================================

-- 创建速率限制记录表
CREATE TABLE IF NOT EXISTS edge_function_rate_limits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    function_name text NOT NULL,
    called_at timestamptz NOT NULL DEFAULT NOW(),
    -- 创建索引优化查询
    CONSTRAINT valid_function_name CHECK (char_length(function_name) <= 100)
);

-- 为查询优化创建索引
CREATE INDEX IF NOT EXISTS idx_edge_function_rate_limits_name_time
ON edge_function_rate_limits (function_name, called_at DESC);

-- 创建自动清理过期记录的函数
CREATE OR REPLACE FUNCTION cleanup_edge_function_rate_limits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count integer;
BEGIN
    -- 删除超过 5 分钟的记录
    DELETE FROM edge_function_rate_limits
    WHERE called_at < NOW() - INTERVAL '5 minutes';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- 添加注释
COMMENT ON TABLE edge_function_rate_limits IS 'Edge Function 速率限制记录表';
COMMENT ON COLUMN edge_function_rate_limits.function_name IS 'Edge Function 名称';
COMMENT ON COLUMN edge_function_rate_limits.called_at IS '调用时间';
COMMENT ON FUNCTION cleanup_edge_function_rate_limits() IS '清理过期的速率限制记录';

-- 验证创建结果
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'edge_function_rate_limits') THEN
        RAISE NOTICE 'Edge function rate limits table created successfully';
    ELSE
        RAISE EXCEPTION 'Failed to create edge_function_rate_limits table';
    END IF;
END $$;

-- 监控检查日志表
-- 记录每次页面检查的结果，用于历史追踪和问题诊断
-- 日志保留策略: 30 天自动清理

CREATE TABLE IF NOT EXISTS monitor_check_logs (
    id BIGSERIAL PRIMARY KEY,
    monitor_id BIGINT NOT NULL REFERENCES page_monitors(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 检查结果
    check_result VARCHAR(20) NOT NULL
        CHECK (check_result IN ('no_change', 'changed', 'failed', 'skipped')),

    -- 变更详情（仅当 check_result = 'changed' 时）
    previous_hash VARCHAR(64),
    current_hash VARCHAR(64),
    similarity_score DECIMAL(5,2), -- 0.00 - 100.00
    change_summary TEXT,

    -- 错误信息（仅当 check_result = 'failed' 时）
    error_message TEXT,

    -- 时间戳
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms INT, -- 检查耗时（毫秒）

    -- 关联的快照（如果创建了新版本）
    new_snapshot_id BIGINT REFERENCES bookmark_snapshots(id),
    archived_version_id BIGINT REFERENCES snapshot_versions(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_check_logs_monitor ON monitor_check_logs(monitor_id);
CREATE INDEX IF NOT EXISTS idx_check_logs_user ON monitor_check_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_check_logs_checked ON monitor_check_logs(checked_at);
CREATE INDEX IF NOT EXISTS idx_check_logs_result ON monitor_check_logs(check_result);

-- 部分索引：仅索引有变化的日志，便于查询历史变更
CREATE INDEX IF NOT EXISTS idx_check_logs_changed
    ON monitor_check_logs(monitor_id, checked_at)
    WHERE check_result = 'changed';

-- RLS 策略
ALTER TABLE monitor_check_logs ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的检查日志
CREATE POLICY "Users can view own check logs"
    ON monitor_check_logs FOR SELECT
    USING (auth.uid() = user_id);

-- Service role 可以管理所有日志
CREATE POLICY "Service role can manage check logs"
    ON monitor_check_logs FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- 添加注释
COMMENT ON TABLE monitor_check_logs IS '监控检查日志表，记录每次检查结果。保留策略: 30天';
COMMENT ON COLUMN monitor_check_logs.check_result IS '检查结果: no_change=无变化, changed=有变化, failed=失败, skipped=跳过';
COMMENT ON COLUMN monitor_check_logs.similarity_score IS '内容相似度评分 0-100，仅在 changed 时有值';
COMMENT ON COLUMN monitor_check_logs.duration_ms IS '检查耗时（毫秒），用于性能监控';

-- 创建清理过期日志的函数（需要 pg_cron 扩展来定时调用）
CREATE OR REPLACE FUNCTION cleanup_expired_check_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM monitor_check_logs
    WHERE checked_at < NOW() - INTERVAL '30 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_check_logs IS '清理 30 天前的检查日志，返回删除数量';

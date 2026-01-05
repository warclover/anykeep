-- 页面监控配置表
-- 用于存储用户的页面变更监控配置
-- 配额限制: FREE=5个监控, PRO=50个监控

CREATE TABLE IF NOT EXISTS page_monitors (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bookmark_id BIGINT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,

    -- 监控配置
    check_interval VARCHAR(20) NOT NULL DEFAULT 'daily'
        CHECK (check_interval IN ('every_6h', 'twice_daily', 'daily', 'weekly', 'custom')),
    custom_interval_hours INT, -- 仅当 check_interval = 'custom' 时使用

    -- 调度信息
    last_checked_at TIMESTAMPTZ,
    next_check_at TIMESTAMPTZ,

    -- 基线快照（用于对比）
    baseline_snapshot_id BIGINT REFERENCES bookmark_snapshots(id),
    baseline_content_hash VARCHAR(64),
    baseline_captured_at TIMESTAMPTZ,

    -- 状态管理
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'failed', 'deleted')),
    consecutive_failures INT NOT NULL DEFAULT 0,
    last_error_message TEXT,

    -- 变更统计
    change_count INT NOT NULL DEFAULT 0,
    last_change_at TIMESTAMPTZ,

    -- 通知设置
    notification_enabled BOOLEAN NOT NULL DEFAULT true,

    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 约束：每个用户对每个书签只能有一个监控配置
    CONSTRAINT unique_user_bookmark_monitor UNIQUE (user_id, bookmark_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_monitors_user ON page_monitors(user_id);
CREATE INDEX IF NOT EXISTS idx_monitors_bookmark ON page_monitors(bookmark_id);

-- 部分索引：仅索引活跃监控，优化调度查询
CREATE INDEX IF NOT EXISTS idx_monitors_active_status
    ON page_monitors(status)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_monitors_next_check
    ON page_monitors(next_check_at)
    WHERE status = 'active';

-- RLS 策略
ALTER TABLE page_monitors ENABLE ROW LEVEL SECURITY;

-- 用户可以管理自己的监控
CREATE POLICY "Users can manage own monitors"
    ON page_monitors FOR ALL
    USING (auth.uid() = user_id);

-- Service role 可以管理所有监控（用于后台调度）
CREATE POLICY "Service role can manage all monitors"
    ON page_monitors FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- 自动更新 updated_at 触发器
CREATE OR REPLACE FUNCTION update_page_monitors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_page_monitors_updated_at
    BEFORE UPDATE ON page_monitors
    FOR EACH ROW
    EXECUTE FUNCTION update_page_monitors_updated_at();

-- 添加注释
COMMENT ON TABLE page_monitors IS '页面监控配置表，用于追踪页面内容变化。配额: FREE=5, PRO=50';
COMMENT ON COLUMN page_monitors.check_interval IS '检查频率: every_6h(Pro), twice_daily(Pro), daily, weekly, custom(Pro)';
COMMENT ON COLUMN page_monitors.consecutive_failures IS '连续失败次数，达到 3 次自动暂停';
COMMENT ON COLUMN page_monitors.baseline_content_hash IS '基线内容哈希，用于快速对比';

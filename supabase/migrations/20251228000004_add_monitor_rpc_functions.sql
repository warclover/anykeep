-- 添加监控变更计数递增函数
-- 用于后台任务安全地递增监控的变更计数

-- 创建递增函数
CREATE OR REPLACE FUNCTION increment_monitor_change_count(monitor_id BIGINT)
RETURNS VOID AS $$
BEGIN
    UPDATE page_monitors
    SET
        change_count = change_count + 1,
        last_change_at = NOW(),
        updated_at = NOW()
    WHERE id = monitor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予 service_role 执行权限
GRANT EXECUTE ON FUNCTION increment_monitor_change_count(BIGINT) TO service_role;

COMMENT ON FUNCTION increment_monitor_change_count IS '递增监控变更计数，由后台任务调用';

-- 原子监控创建函数
-- 解决配额检查的 TOCTOU 漏洞
-- 使用 FOR UPDATE 锁确保配额检查和创建的原子性

-- 创建原子监控函数
CREATE OR REPLACE FUNCTION create_monitor_atomic(
    p_user_id UUID,
    p_bookmark_id BIGINT,
    p_check_interval VARCHAR(20),
    p_custom_interval_hours INT DEFAULT NULL,
    p_notification_enabled BOOLEAN DEFAULT TRUE,
    p_quota_limit INT DEFAULT 5
)
RETURNS TABLE (
    success BOOLEAN,
    error_code VARCHAR(50),
    error_message TEXT,
    monitor_id BIGINT
) AS $$
DECLARE
    v_current_count INT;
    v_existing_id BIGINT;
    v_new_id BIGINT;
    v_interval_hours INT;
    v_next_check_at TIMESTAMPTZ;
BEGIN
    -- 1. 获取用户当前监控数量（带行级锁防止并发）
    SELECT COUNT(*) INTO v_current_count
    FROM page_monitors
    WHERE user_id = p_user_id
      AND status != 'deleted'
    FOR UPDATE; -- 锁定该用户的监控记录

    -- 2. 检查配额
    IF v_current_count >= p_quota_limit THEN
        RETURN QUERY SELECT
            FALSE::BOOLEAN,
            'QUOTA_EXCEEDED'::VARCHAR(50),
            format('监控配额已达上限（%s个）', p_quota_limit)::TEXT,
            NULL::BIGINT;
        RETURN;
    END IF;

    -- 3. 检查是否已存在该书签的监控
    SELECT id INTO v_existing_id
    FROM page_monitors
    WHERE user_id = p_user_id
      AND bookmark_id = p_bookmark_id
      AND status != 'deleted';

    IF v_existing_id IS NOT NULL THEN
        RETURN QUERY SELECT
            FALSE::BOOLEAN,
            'ALREADY_EXISTS'::VARCHAR(50),
            '该书签已设置监控，无需重复创建'::TEXT,
            v_existing_id;
        RETURN;
    END IF;

    -- 4. 计算下次检查时间
    v_interval_hours := COALESCE(p_custom_interval_hours, CASE p_check_interval
        WHEN 'every_6h' THEN 6
        WHEN 'twice_daily' THEN 12
        WHEN 'daily' THEN 24
        WHEN 'weekly' THEN 168
        ELSE 24
    END);
    v_next_check_at := NOW() + (v_interval_hours || ' hours')::INTERVAL;

    -- 5. 原子创建监控
    INSERT INTO page_monitors (
        user_id,
        bookmark_id,
        check_interval,
        custom_interval_hours,
        notification_enabled,
        status,
        next_check_at
    ) VALUES (
        p_user_id,
        p_bookmark_id,
        p_check_interval,
        CASE WHEN p_check_interval = 'custom' THEN p_custom_interval_hours ELSE NULL END,
        p_notification_enabled,
        'active',
        v_next_check_at
    )
    RETURNING id INTO v_new_id;

    RETURN QUERY SELECT
        TRUE::BOOLEAN,
        NULL::VARCHAR(50),
        NULL::TEXT,
        v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予认证用户执行权限
GRANT EXECUTE ON FUNCTION create_monitor_atomic(UUID, BIGINT, VARCHAR, INT, BOOLEAN, INT) TO authenticated;

COMMENT ON FUNCTION create_monitor_atomic IS '原子创建监控函数，解决配额检查的 TOCTOU 漏洞';

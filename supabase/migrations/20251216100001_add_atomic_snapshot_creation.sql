-- =============================================================================
-- Migration: Add Atomic Snapshot Creation
-- Description: V4.2.16 配额检查与快照创建原子化，避免竞态条件
-- Date: 2025-12-16
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 原子化快照创建函数
-- 在单个事务中完成：配额检查 + 记录创建 + 任务入队
-- 使用 SELECT FOR UPDATE 锁定配额记录，防止并发超配
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION atomic_create_snapshot(
    p_user_id UUID,
    p_bookmark_id BIGINT,
    p_snapshot_type VARCHAR(20) DEFAULT 'basic',
    p_estimated_size BIGINT DEFAULT 102400,
    p_trigger_source VARCHAR(20) DEFAULT 'manual',
    p_trigger_tag VARCHAR(100) DEFAULT NULL,
    p_priority INT DEFAULT 0
)
RETURNS TABLE (
    success BOOLEAN,
    snapshot_id BIGINT,
    job_id UUID,
    error_code VARCHAR(50),
    error_message TEXT
) AS $$
DECLARE
    v_membership VARCHAR(20);
    v_current_usage BIGINT;
    v_current_count INT;
    v_quota_bytes BIGINT;
    v_max_count INT;
    v_bookmark_url TEXT;
    v_existing_snapshot_id BIGINT;
    v_new_snapshot_id BIGINT;
    v_new_job_id UUID;
    v_expires_at TIMESTAMPTZ;
    v_job_type VARCHAR(50);
BEGIN
    -- 1. 锁定用户配额相关数据（防止并发）
    -- 使用 profiles 表作为锁点
    PERFORM 1 FROM profiles WHERE id = p_user_id FOR UPDATE;

    -- 2. 获取会员类型和配额
    SELECT COALESCE(membership_type, 'FREE') INTO v_membership
    FROM profiles WHERE id = p_user_id;

    -- 设置配额限制
    IF v_membership = 'PRO' THEN
        v_quota_bytes := 524288000;  -- 500MB
        v_max_count := 1000;
        v_expires_at := NULL;  -- Pro 永不过期
    ELSE
        v_quota_bytes := 52428800;   -- 50MB
        v_max_count := 100;
        v_expires_at := NOW() + INTERVAL '30 days';
    END IF;

    -- 3. 获取当前使用量（在锁内）
    SELECT COALESCE(SUM(file_size), 0) INTO v_current_usage
    FROM bookmark_snapshots
    WHERE user_id = p_user_id AND status = 'completed';

    SELECT COUNT(*) INTO v_current_count
    FROM bookmark_snapshots
    WHERE user_id = p_user_id AND status IN ('pending', 'processing', 'completed');

    -- 4. 检查配额
    IF (v_current_usage + p_estimated_size) > v_quota_bytes THEN
        RETURN QUERY SELECT
            FALSE,
            NULL::BIGINT,
            NULL::UUID,
            'QUOTA_BYTES_EXCEEDED'::VARCHAR(50),
            format('存储配额不足: 已用 %s / %s bytes', v_current_usage, v_quota_bytes)::TEXT;
        RETURN;
    END IF;

    IF v_current_count >= v_max_count THEN
        RETURN QUERY SELECT
            FALSE,
            NULL::BIGINT,
            NULL::UUID,
            'QUOTA_COUNT_EXCEEDED'::VARCHAR(50),
            format('快照数量已满: %s / %s', v_current_count, v_max_count)::TEXT;
        RETURN;
    END IF;

    -- 5. 检查快照类型权限
    IF p_snapshot_type IN ('standard', 'full') AND v_membership != 'PRO' THEN
        RETURN QUERY SELECT
            FALSE,
            NULL::BIGINT,
            NULL::UUID,
            'INVALID_SNAPSHOT_TYPE'::VARCHAR(50),
            format('%s 类型快照需要 Pro 会员', p_snapshot_type)::TEXT;
        RETURN;
    END IF;

    -- 6. 检查书签是否存在且属于用户
    SELECT url INTO v_bookmark_url
    FROM bookmarks
    WHERE id = p_bookmark_id
      AND user_id = p_user_id
      AND deleted_at IS NULL;

    IF v_bookmark_url IS NULL THEN
        RETURN QUERY SELECT
            FALSE,
            NULL::BIGINT,
            NULL::UUID,
            'BOOKMARK_NOT_FOUND'::VARCHAR(50),
            '书签不存在或无权访问'::TEXT;
        RETURN;
    END IF;

    -- 7. 检查是否已有活跃快照
    SELECT id INTO v_existing_snapshot_id
    FROM bookmark_snapshots
    WHERE bookmark_id = p_bookmark_id
      AND user_id = p_user_id
      AND status IN ('pending', 'processing', 'completed')
    LIMIT 1;

    IF v_existing_snapshot_id IS NOT NULL THEN
        RETURN QUERY SELECT
            FALSE,
            v_existing_snapshot_id,
            NULL::UUID,
            'ALREADY_EXISTS'::VARCHAR(50),
            '该书签已有快照或快照任务进行中'::TEXT;
        RETURN;
    END IF;

    -- 8. 创建快照记录（在锁内，确保原子性）
    INSERT INTO bookmark_snapshots (
        bookmark_id,
        user_id,
        snapshot_type,
        status,
        original_url,
        expires_at,
        trigger_source,
        trigger_tag
    ) VALUES (
        p_bookmark_id,
        p_user_id,
        p_snapshot_type,
        'pending',
        v_bookmark_url,
        v_expires_at,
        p_trigger_source,
        p_trigger_tag
    )
    RETURNING id INTO v_new_snapshot_id;

    -- 9. 创建任务队列记录
    v_job_type := 'create_snapshot_' || p_snapshot_type;

    INSERT INTO job_queue (
        user_id,
        type,
        payload,
        priority,
        scheduled_at
    ) VALUES (
        p_user_id,
        v_job_type,
        jsonb_build_object(
            'bookmark_id', p_bookmark_id,
            'snapshot_id', v_new_snapshot_id,
            'url', v_bookmark_url,
            'snapshot_type', p_snapshot_type,
            'user_id', p_user_id,
            'priority', CASE p_priority WHEN 1 THEN 'high' WHEN -1 THEN 'low' ELSE 'normal' END
        ),
        p_priority,
        NOW()
    )
    RETURNING id INTO v_new_job_id;

    -- 10. 更新快照的 job_id
    UPDATE bookmark_snapshots
    SET job_id = v_new_job_id
    WHERE id = v_new_snapshot_id;

    -- 11. 返回成功结果
    RETURN QUERY SELECT
        TRUE,
        v_new_snapshot_id,
        v_new_job_id,
        NULL::VARCHAR(50),
        NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 注释
COMMENT ON FUNCTION atomic_create_snapshot IS 'V4.2.16: 原子化快照创建 - 配额检查与记录创建在单个事务中完成，防止竞态条件';

-- -----------------------------------------------------------------------------
-- 2. 原子化批量快照创建函数
-- 用于高效批量创建，一次性检查配额后批量插入
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION atomic_batch_create_snapshots(
    p_user_id UUID,
    p_bookmark_ids BIGINT[],
    p_snapshot_type VARCHAR(20) DEFAULT 'basic',
    p_trigger_source VARCHAR(20) DEFAULT 'batch',
    p_max_batch_size INT DEFAULT 50
)
RETURNS TABLE (
    total_requested INT,
    total_created INT,
    total_skipped INT,
    available_slots INT,
    created_snapshot_ids BIGINT[]
) AS $$
DECLARE
    v_membership VARCHAR(20);
    v_current_count INT;
    v_max_count INT;
    v_available_slots INT;
    v_ids_to_process BIGINT[];
    v_expires_at TIMESTAMPTZ;
    v_created_ids BIGINT[] := ARRAY[]::BIGINT[];
    v_bookmark_id BIGINT;
    v_bookmark_url TEXT;
    v_new_snapshot_id BIGINT;
    v_skipped INT := 0;
BEGIN
    -- 1. 锁定用户配额
    PERFORM 1 FROM profiles WHERE id = p_user_id FOR UPDATE;

    -- 2. 获取会员类型和配额
    SELECT COALESCE(membership_type, 'FREE') INTO v_membership
    FROM profiles WHERE id = p_user_id;

    IF v_membership = 'PRO' THEN
        v_max_count := 1000;
        v_expires_at := NULL;
    ELSE
        v_max_count := 100;
        v_expires_at := NOW() + INTERVAL '30 days';
    END IF;

    -- 3. 获取当前快照数量
    SELECT COUNT(*) INTO v_current_count
    FROM bookmark_snapshots
    WHERE user_id = p_user_id AND status IN ('pending', 'processing', 'completed');

    -- 4. 计算可用名额
    v_available_slots := GREATEST(0, v_max_count - v_current_count);

    -- 5. 限制处理数量
    v_ids_to_process := p_bookmark_ids[1:LEAST(array_length(p_bookmark_ids, 1), v_available_slots, p_max_batch_size)];

    -- 6. 逐个处理（跳过已有快照的）
    FOREACH v_bookmark_id IN ARRAY v_ids_to_process
    LOOP
        -- 检查书签是否存在
        SELECT url INTO v_bookmark_url
        FROM bookmarks
        WHERE id = v_bookmark_id
          AND user_id = p_user_id
          AND deleted_at IS NULL;

        IF v_bookmark_url IS NULL THEN
            v_skipped := v_skipped + 1;
            CONTINUE;
        END IF;

        -- 检查是否已有快照
        IF EXISTS (
            SELECT 1 FROM bookmark_snapshots
            WHERE bookmark_id = v_bookmark_id
              AND user_id = p_user_id
              AND status IN ('pending', 'processing', 'completed')
        ) THEN
            v_skipped := v_skipped + 1;
            CONTINUE;
        END IF;

        -- 创建快照记录
        INSERT INTO bookmark_snapshots (
            bookmark_id,
            user_id,
            snapshot_type,
            status,
            original_url,
            expires_at,
            trigger_source
        ) VALUES (
            v_bookmark_id,
            p_user_id,
            p_snapshot_type,
            'pending',
            v_bookmark_url,
            v_expires_at,
            p_trigger_source
        )
        RETURNING id INTO v_new_snapshot_id;

        v_created_ids := array_append(v_created_ids, v_new_snapshot_id);
    END LOOP;

    -- 7. 批量创建任务
    INSERT INTO job_queue (user_id, type, payload, priority, scheduled_at)
    SELECT
        p_user_id,
        'create_snapshot_' || p_snapshot_type,
        jsonb_build_object(
            'bookmark_id', bs.bookmark_id,
            'snapshot_id', bs.id,
            'url', bs.original_url,
            'snapshot_type', p_snapshot_type,
            'user_id', p_user_id,
            'priority', 'normal'
        ),
        0,
        NOW()
    FROM bookmark_snapshots bs
    WHERE bs.id = ANY(v_created_ids);

    -- 8. 返回结果
    RETURN QUERY SELECT
        array_length(p_bookmark_ids, 1)::INT,
        array_length(v_created_ids, 1)::INT,
        v_skipped,
        v_available_slots,
        v_created_ids;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION atomic_batch_create_snapshots IS 'V4.2.16: 原子化批量快照创建 - 一次性检查配额后批量插入';

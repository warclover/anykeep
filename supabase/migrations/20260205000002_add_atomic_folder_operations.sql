/**
 * 原子文件夹操作函数
 *
 * 解决文件夹创建的 TOCTOU 漏洞
 * 使用 FOR UPDATE 锁确保配额检查和创建的原子性
 *
 * @version 1.0.0
 * @since 2026-02-05
 */

-- ============================================
-- 原子创建文件夹函数
-- ============================================

CREATE OR REPLACE FUNCTION create_folder_atomic(
    p_user_id UUID,
    p_name TEXT,
    p_parent_id BIGINT DEFAULT NULL,
    p_color VARCHAR(20) DEFAULT NULL,
    p_icon VARCHAR(50) DEFAULT NULL,
    p_quota_limit INT DEFAULT 100
)
RETURNS TABLE (
    success BOOLEAN,
    error_code VARCHAR(50),
    error_message TEXT,
    folder_id BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_count INT;
    v_existing_id BIGINT;
    v_new_id BIGINT;
    v_parent_user_id UUID;
BEGIN
    -- 1. 获取用户当前文件夹数量（带行级锁防止并发）
    SELECT COUNT(*) INTO v_current_count
    FROM folders
    WHERE user_id = p_user_id
      AND deleted_at IS NULL
    FOR UPDATE;

    -- 2. 检查配额
    IF v_current_count >= p_quota_limit THEN
        RETURN QUERY SELECT
            FALSE::BOOLEAN,
            'QUOTA_EXCEEDED'::VARCHAR(50),
            format('文件夹配额已达上限（%s个）', p_quota_limit)::TEXT,
            NULL::BIGINT;
        RETURN;
    END IF;

    -- 3. 检查同名文件夹
    IF p_parent_id IS NOT NULL THEN
        -- 检查父文件夹是否属于当前用户
        SELECT user_id INTO v_parent_user_id
        FROM folders
        WHERE id = p_parent_id AND deleted_at IS NULL;

        IF v_parent_user_id IS NULL THEN
            RETURN QUERY SELECT
                FALSE::BOOLEAN,
                'PARENT_NOT_FOUND'::VARCHAR(50),
                '父文件夹不存在'::TEXT,
                NULL::BIGINT;
            RETURN;
        END IF;

        IF v_parent_user_id != p_user_id THEN
            RETURN QUERY SELECT
                FALSE::BOOLEAN,
                'PARENT_ACCESS_DENIED'::VARCHAR(50),
                '无权使用该父文件夹'::TEXT,
                NULL::BIGINT;
            RETURN;
        END IF;

        -- 检查同级同名
        SELECT id INTO v_existing_id
        FROM folders
        WHERE user_id = p_user_id
          AND parent_id = p_parent_id
          AND name = p_name
          AND deleted_at IS NULL
        LIMIT 1;
    ELSE
        -- 检查根级同名
        SELECT id INTO v_existing_id
        FROM folders
        WHERE user_id = p_user_id
          AND parent_id IS NULL
          AND name = p_name
          AND deleted_at IS NULL
        LIMIT 1;
    END IF;

    IF v_existing_id IS NOT NULL THEN
        RETURN QUERY SELECT
            FALSE::BOOLEAN,
            'ALREADY_EXISTS'::VARCHAR(50),
            '同名文件夹已存在'::TEXT,
            v_existing_id;
        RETURN;
    END IF;

    -- 4. 原子创建文件夹
    INSERT INTO folders (
        user_id,
        name,
        parent_id,
        color,
        icon
    ) VALUES (
        p_user_id,
        p_name,
        p_parent_id,
        p_color,
        p_icon
    )
    RETURNING id INTO v_new_id;

    RETURN QUERY SELECT
        TRUE::BOOLEAN,
        NULL::VARCHAR(50),
        NULL::TEXT,
        v_new_id;
END;
$$;

-- ============================================
-- 原子批量创建文件夹函数
-- ============================================

CREATE OR REPLACE FUNCTION batch_create_folders_atomic(
    p_user_id UUID,
    p_folders JSONB,  -- 格式: [{name, parent_id?, color?, icon?}, ...]
    p_quota_limit INT DEFAULT 100
)
RETURNS TABLE (
    success BOOLEAN,
    error_code VARCHAR(50),
    error_message TEXT,
    created_folders JSONB,
    failed_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_count INT;
    v_folder RECORD;
    v_new_id BIGINT;
    v_created JSONB := '[]'::JSONB;
    v_failed INT := 0;
    v_total_to_create INT;
BEGIN
    -- 1. 获取用户当前文件夹数量（带行级锁）
    SELECT COUNT(*) INTO v_current_count
    FROM folders
    WHERE user_id = p_user_id
      AND deleted_at IS NULL
    FOR UPDATE;

    -- 2. 计算要创建的数量
    v_total_to_create := jsonb_array_length(p_folders);

    -- 3. 检查配额
    IF v_current_count + v_total_to_create > p_quota_limit THEN
        RETURN QUERY SELECT
            FALSE::BOOLEAN,
            'QUOTA_EXCEEDED'::VARCHAR(50),
            format('文件夹配额不足，当前 %s 个，要创建 %s 个，上限 %s 个',
                   v_current_count, v_total_to_create, p_quota_limit)::TEXT,
            NULL::JSONB,
            v_total_to_create::INT;
        RETURN;
    END IF;

    -- 4. 逐个创建文件夹
    FOR v_folder IN SELECT * FROM jsonb_to_recordset(p_folders) AS (
        name TEXT,
        parent_id BIGINT,
        color VARCHAR(20),
        icon VARCHAR(50)
    )
    LOOP
        BEGIN
            -- 检查同名
            DECLARE
                v_existing_id BIGINT;
                v_parent_user_id UUID;
            BEGIN
                IF v_folder.parent_id IS NOT NULL THEN
                    -- 验证父文件夹
                    SELECT user_id INTO v_parent_user_id
                    FROM folders
                    WHERE id = v_folder.parent_id AND deleted_at IS NULL;

                    IF v_parent_user_id IS NULL OR v_parent_user_id != p_user_id THEN
                        RAISE EXCEPTION 'PARENT_INVALID';
                    END IF;

                    SELECT id INTO v_existing_id
                    FROM folders
                    WHERE user_id = p_user_id
                      AND parent_id = v_folder.parent_id
                      AND name = v_folder.name
                      AND deleted_at IS NULL
                    LIMIT 1;
                ELSE
                    SELECT id INTO v_existing_id
                    FROM folders
                    WHERE user_id = p_user_id
                      AND parent_id IS NULL
                      AND name = v_folder.name
                      AND deleted_at IS NULL
                    LIMIT 1;
                END IF;

                IF v_existing_id IS NOT NULL THEN
                    RAISE EXCEPTION 'ALREADY_EXISTS';
                END IF;
            END;

            -- 插入文件夹
            INSERT INTO folders (
                user_id,
                name,
                parent_id,
                color,
                icon
            ) VALUES (
                p_user_id,
                v_folder.name,
                v_folder.parent_id,
                v_folder.color,
                v_folder.icon
            )
            RETURNING id INTO v_new_id;

            -- 添加到成功列表
            v_created := v_created || jsonb_build_object(
                'name', v_folder.name,
                'id', v_new_id,
                'parent_id', v_folder.parent_id
            );

        EXCEPTION
            WHEN OTHERS THEN
                v_failed := v_failed + 1;
        END;
    END LOOP;

    -- 5. 返回结果
    RETURN QUERY SELECT
        TRUE::BOOLEAN,
        NULL::VARCHAR(50),
        NULL::TEXT,
        v_created,
        v_failed;
END;
$$;

-- ============================================
-- 授权
-- ============================================

GRANT EXECUTE ON FUNCTION create_folder_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION create_folder_atomic TO service_role;

GRANT EXECUTE ON FUNCTION batch_create_folders_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION batch_create_folders_atomic TO service_role;

-- ============================================
-- 添加注释
-- ============================================

COMMENT ON FUNCTION create_folder_atomic IS '原子创建文件夹函数，解决配额检查的 TOCTOU 漏洞';
COMMENT ON FUNCTION batch_create_folders_atomic IS '原子批量创建文件夹函数，支持事务回滚';

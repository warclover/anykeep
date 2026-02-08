/**
 * 原子书签操作函数
 *
 * 解决书签批量更新的竞态条件
 * 使用 FOR UPDATE 锁确保操作的原子性
 *
 * @version 1.0.0
 * @since 2026-02-05
 */

-- ============================================
-- 原子批量移动书签到文件夹函数
-- ============================================

CREATE OR REPLACE FUNCTION batch_move_bookmarks_atomic(
    p_user_id UUID,
    p_bookmark_ids BIGINT[],
    p_target_folder_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    error_code VARCHAR(50),
    error_message TEXT,
    updated_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_target_user_id UUID;
    v_updated_count INT;
BEGIN
    -- 1. 验证目标文件夹
    IF p_target_folder_id IS NOT NULL THEN
        SELECT user_id INTO v_target_user_id
        FROM folders
        WHERE id = p_target_folder_id AND deleted_at IS NULL;

        IF v_target_user_id IS NULL THEN
            RETURN QUERY SELECT
                FALSE::BOOLEAN,
                'FOLDER_NOT_FOUND'::VARCHAR(50),
                '目标文件夹不存在'::TEXT,
                0::INT;
            RETURN;
        END IF;

        IF v_target_user_id != p_user_id THEN
            RETURN QUERY SELECT
                FALSE::BOOLEAN,
                'ACCESS_DENIED'::VARCHAR(50),
                '无权操作该文件夹'::TEXT,
                0::INT;
            RETURN;
        END IF;
    END IF;

    -- 2. 原子更新书签（UPDATE 语句自带排他锁，无需额外 FOR UPDATE）
    UPDATE bookmarks b
    SET folder_id = p_target_folder_id, updated_at = NOW()
    WHERE b.id = ANY(p_bookmark_ids)
      AND b.user_id = p_user_id
      AND b.deleted_at IS NULL;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    -- 3. 检查是否有书签未被更新（可能不存在或无权操作）
    IF v_updated_count != array_length(p_bookmark_ids, 1) THEN
        RETURN QUERY SELECT
            TRUE::BOOLEAN,
            'PARTIAL_SUCCESS'::VARCHAR(50),
            format('部分书签未更新：成功 %s/%s',
                   v_updated_count, array_length(p_bookmark_ids, 1))::TEXT,
            v_updated_count;
        RETURN;
    END IF;

    RETURN QUERY SELECT
        TRUE::BOOLEAN,
        NULL::VARCHAR(50),
        NULL::TEXT,
        v_updated_count;
END;
$$;

-- ============================================
-- 原子批量添加标签函数
-- ============================================

CREATE OR REPLACE FUNCTION batch_add_tags_atomic(
    p_user_id UUID,
    p_bookmark_ids BIGINT[],
    p_tags TEXT[]
)
RETURNS TABLE (
    success BOOLEAN,
    error_code VARCHAR(50),
    error_message TEXT,
    added_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tag TEXT;
    v_bookmark_id BIGINT;
    v_added_count INT := 0;
    v_rows INT;
BEGIN
    -- 验证书签所有权
    FOR v_bookmark_id IN SELECT unnest(p_bookmark_ids)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM bookmarks
            WHERE id = v_bookmark_id
              AND user_id = p_user_id
              AND deleted_at IS NULL
        ) THEN
            RETURN QUERY SELECT
                FALSE::BOOLEAN,
                'BOOKMARK_NOT_FOUND'::VARCHAR(50),
                format('书签 %s 不存在或无权操作', v_bookmark_id)::TEXT,
                v_added_count;
            RETURN;
        END IF;
    END LOOP;

    -- 批量添加标签（使用 ON CONFLICT 避免重复）
    FOREACH v_tag IN ARRAY p_tags
    LOOP
        INSERT INTO bookmark_tags (user_id, bookmark_id, tag_name)
        SELECT p_user_id, unnest(p_bookmark_ids), v_tag
        ON CONFLICT (user_id, bookmark_id, tag_name) DO NOTHING;

        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_added_count := v_added_count + v_rows;
    END LOOP;

    RETURN QUERY SELECT
        TRUE::BOOLEAN,
        NULL::VARCHAR(50),
        NULL::TEXT,
        v_added_count;
END;
$$;

-- ============================================
-- 原子删除标签函数
-- ============================================

CREATE OR REPLACE FUNCTION batch_remove_tags_atomic(
    p_user_id UUID,
    p_bookmark_ids BIGINT[],
    p_tags TEXT[]
)
RETURNS TABLE (
    success BOOLEAN,
    error_code VARCHAR(50),
    error_message TEXT,
    removed_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_removed_count INT;
BEGIN
    -- 批量删除标签
    DELETE FROM bookmark_tags
    WHERE user_id = p_user_id
      AND bookmark_id = ANY(p_bookmark_ids)
      AND tag_name = ANY(p_tags);

    GET DIAGNOSTICS v_removed_count = ROW_COUNT;

    RETURN QUERY SELECT
        TRUE::BOOLEAN,
        NULL::VARCHAR(50),
        NULL::TEXT,
        v_removed_count;
END;
$$;

-- ============================================
-- 原子批量删除书签函数（软删除）
-- ============================================

CREATE OR REPLACE FUNCTION batch_soft_delete_bookmarks_atomic(
    p_user_id UUID,
    p_bookmark_ids BIGINT[]
)
RETURNS TABLE (
    success BOOLEAN,
    error_code VARCHAR(50),
    error_message TEXT,
    deleted_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INT;
BEGIN
    -- 原子软删除书签（UPDATE 语句自带排他锁，无需额外 FOR UPDATE）
    UPDATE bookmarks
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = ANY(p_bookmark_ids)
      AND user_id = p_user_id
      AND deleted_at IS NULL;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    IF v_deleted_count != array_length(p_bookmark_ids, 1) THEN
        RETURN QUERY SELECT
            TRUE::BOOLEAN,
            'PARTIAL_SUCCESS'::VARCHAR(50),
            format('部分书签未删除：成功 %s/%s',
                   v_deleted_count, array_length(p_bookmark_ids, 1))::TEXT,
            v_deleted_count;
        RETURN;
    END IF;

    RETURN QUERY SELECT
        TRUE::BOOLEAN,
        NULL::VARCHAR(50),
        NULL::TEXT,
        v_deleted_count;
END;
$$;

-- ============================================
-- 授权
-- ============================================

GRANT EXECUTE ON FUNCTION batch_move_bookmarks_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION batch_move_bookmarks_atomic TO service_role;

GRANT EXECUTE ON FUNCTION batch_add_tags_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION batch_add_tags_atomic TO service_role;

GRANT EXECUTE ON FUNCTION batch_remove_tags_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION batch_remove_tags_atomic TO service_role;

GRANT EXECUTE ON FUNCTION batch_soft_delete_bookmarks_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION batch_soft_delete_bookmarks_atomic TO service_role;

-- ============================================
-- 添加注释
-- ============================================

COMMENT ON FUNCTION batch_move_bookmarks_atomic IS '原子批量移动书签函数，带并发保护';
COMMENT ON FUNCTION batch_add_tags_atomic IS '原子批量添加标签函数，使用 ON CONFLICT 避免重复';
COMMENT ON FUNCTION batch_remove_tags_atomic IS '原子批量删除标签函数';
COMMENT ON FUNCTION batch_soft_delete_bookmarks_atomic IS '原子批量软删除书签函数';

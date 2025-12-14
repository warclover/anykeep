-- ============================================================================
-- Migration: 添加文件夹事务函数
-- Version: 20251215000005
-- Description: 为文件夹合并和批量排序操作添加原子性事务支持
-- ============================================================================

-- 1. 合并文件夹事务函数
-- 将源文件夹的所有书签移动到目标文件夹，然后删除源文件夹
-- 保证操作的原子性，避免数据不一致
CREATE OR REPLACE FUNCTION merge_folders_atomic(
  p_source_folder_id BIGINT,
  p_target_folder_id BIGINT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_moved_count INT;
  v_source_name TEXT;
  v_target_name TEXT;
BEGIN
  -- 验证源文件夹存在且属于该用户
  SELECT name INTO v_source_name
  FROM folders
  WHERE id = p_source_folder_id
    AND user_id = p_user_id
    AND deleted_at IS NULL;

  IF v_source_name IS NULL THEN
    RAISE EXCEPTION 'Source folder not found or already deleted';
  END IF;

  -- 验证目标文件夹存在且属于该用户
  SELECT name INTO v_target_name
  FROM folders
  WHERE id = p_target_folder_id
    AND user_id = p_user_id
    AND deleted_at IS NULL;

  IF v_target_name IS NULL THEN
    RAISE EXCEPTION 'Target folder not found or already deleted';
  END IF;

  -- 不能合并到自己
  IF p_source_folder_id = p_target_folder_id THEN
    RAISE EXCEPTION 'Cannot merge folder into itself';
  END IF;

  -- 步骤1: 移动所有书签到目标文件夹
  UPDATE bookmarks
  SET
    folder_id = p_target_folder_id,
    updated_at = NOW()
  WHERE folder_id = p_source_folder_id
    AND user_id = p_user_id
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_moved_count = ROW_COUNT;

  -- 步骤2: 软删除源文件夹
  UPDATE folders
  SET
    deleted_at = NOW(),
    updated_at = NOW()
  WHERE id = p_source_folder_id
    AND user_id = p_user_id;

  -- 返回操作结果
  RETURN jsonb_build_object(
    'success', true,
    'bookmarksMoved', v_moved_count,
    'sourceFolderName', v_source_name,
    'targetFolderName', v_target_name,
    'sourceFolderId', p_source_folder_id,
    'targetFolderId', p_target_folder_id
  );

EXCEPTION
  WHEN OTHERS THEN
    -- 事务会自动回滚
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION merge_folders_atomic IS '原子性合并文件夹：移动书签并删除源文件夹';


-- 2. 批量排序事务函数
-- 一次性更新多个文件夹的排序，保证原子性
CREATE OR REPLACE FUNCTION batch_reorder_folders(
  p_user_id UUID,
  p_updates JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_update_record RECORD;
  v_updated_count INT := 0;
BEGIN
  -- 验证输入不为空
  IF p_updates IS NULL OR jsonb_array_length(p_updates) = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'updatedCount', 0,
      'message', 'No updates provided'
    );
  END IF;

  -- 遍历更新数组，逐个更新排序
  FOR v_update_record IN
    SELECT
      (value->>'id')::BIGINT as folder_id,
      (value->>'sort_order')::INT as new_sort_order
    FROM jsonb_array_elements(p_updates)
  LOOP
    -- 更新单个文件夹的排序
    UPDATE folders
    SET
      sort_order = v_update_record.new_sort_order,
      updated_at = NOW()
    WHERE id = v_update_record.folder_id
      AND user_id = p_user_id
      AND deleted_at IS NULL;

    IF FOUND THEN
      v_updated_count := v_updated_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updatedCount', v_updated_count,
    'requestedCount', jsonb_array_length(p_updates)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION batch_reorder_folders IS '批量更新文件夹排序（事务保护）';


-- 3. 级联删除文件夹函数（可选：删除文件夹及其书签）
CREATE OR REPLACE FUNCTION delete_folder_cascade(
  p_folder_id BIGINT,
  p_user_id UUID,
  p_delete_bookmarks BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folder_name TEXT;
  v_deleted_bookmarks INT := 0;
BEGIN
  -- 验证文件夹存在且属于该用户
  SELECT name INTO v_folder_name
  FROM folders
  WHERE id = p_folder_id
    AND user_id = p_user_id
    AND deleted_at IS NULL;

  IF v_folder_name IS NULL THEN
    RAISE EXCEPTION 'Folder not found or already deleted';
  END IF;

  -- 如果需要删除书签
  IF p_delete_bookmarks THEN
    UPDATE bookmarks
    SET
      deleted_at = NOW(),
      updated_at = NOW()
    WHERE folder_id = p_folder_id
      AND user_id = p_user_id
      AND deleted_at IS NULL;

    GET DIAGNOSTICS v_deleted_bookmarks = ROW_COUNT;
  END IF;

  -- 软删除文件夹
  UPDATE folders
  SET
    deleted_at = NOW(),
    updated_at = NOW()
  WHERE id = p_folder_id
    AND user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'folderName', v_folder_name,
    'folderId', p_folder_id,
    'deletedBookmarks', v_deleted_bookmarks
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION delete_folder_cascade IS '级联删除文件夹（可选删除书签）';


-- 4. 授权 authenticated 用户调用这些函数
GRANT EXECUTE ON FUNCTION merge_folders_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION batch_reorder_folders TO authenticated;
GRANT EXECUTE ON FUNCTION delete_folder_cascade TO authenticated;

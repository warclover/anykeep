-- ============================================================================
-- Migration: 修复文件夹事务函数
-- Version: 20251215000006
-- Description: 修复竞态条件和添加 ROW_COUNT 验证
-- ============================================================================

-- 1. 修复 merge_folders_atomic：添加源文件夹删除验证
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
  v_deleted_count INT;
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

  -- 步骤2: 软删除源文件夹（P0-7 修复：添加 ROW_COUNT 验证）
  UPDATE folders
  SET
    deleted_at = NOW(),
    updated_at = NOW()
  WHERE id = p_source_folder_id
    AND user_id = p_user_id
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- 验证源文件夹确实被删除了
  IF v_deleted_count = 0 THEN
    RAISE EXCEPTION 'Failed to delete source folder: folder may have been deleted by another process';
  END IF;

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

-- 更新函数注释
COMMENT ON FUNCTION merge_folders_atomic IS '原子性合并文件夹：移动书签并删除源文件夹（含 ROW_COUNT 验证）';


-- 2. 修复 delete_folder_cascade：添加书签检查避免竞态条件（P0-3）
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
  v_bookmark_count INT;
  v_deleted_bookmarks INT := 0;
  v_deleted_folder INT;
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

  -- P0-3 修复：在事务内检查书签数量，避免竞态条件
  SELECT COUNT(*) INTO v_bookmark_count
  FROM bookmarks
  WHERE folder_id = p_folder_id
    AND user_id = p_user_id
    AND deleted_at IS NULL;

  -- 如果有书签且不允许删除，返回错误
  IF v_bookmark_count > 0 AND NOT p_delete_bookmarks THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Folder contains %s bookmark(s). Set p_delete_bookmarks=true to delete them.', v_bookmark_count),
      'bookmarkCount', v_bookmark_count
    );
  END IF;

  -- 如果需要删除书签
  IF p_delete_bookmarks AND v_bookmark_count > 0 THEN
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
    AND user_id = p_user_id
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_deleted_folder = ROW_COUNT;

  -- 验证文件夹确实被删除了
  IF v_deleted_folder = 0 THEN
    RAISE EXCEPTION 'Failed to delete folder: folder may have been deleted by another process';
  END IF;

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

-- 更新函数注释
COMMENT ON FUNCTION delete_folder_cascade IS '级联删除文件夹（含书签检查和 ROW_COUNT 验证）';

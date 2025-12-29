-- Migration: North Star Phase 1 - P0 Fixes
-- Version: 20251229100002
-- Description: P0 优先级修复 - RPC 原子操作和事务支持

-- ============================================
-- 1. toggle_bookmark_starred - 原子切换收藏状态
-- 解决竞态条件问题
-- ============================================
CREATE OR REPLACE FUNCTION toggle_bookmark_starred(
  p_bookmark_id INTEGER,
  p_user_id UUID
)
RETURNS TABLE (
  id INTEGER,
  url TEXT,
  title TEXT,
  description TEXT,
  platform TEXT,
  cover_url TEXT,
  folder_id INTEGER,
  ai_summary TEXT,
  ai_tags TEXT[],
  user_tags TEXT[],
  is_read BOOLEAN,
  is_starred BOOLEAN,
  is_in_trash BOOLEAN,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  starred_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE bookmarks b
  SET
    is_starred = NOT b.is_starred,
    starred_at = CASE WHEN NOT b.is_starred THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE b.id = p_bookmark_id
    AND b.user_id = p_user_id
    AND b.deleted_at IS NULL
  RETURNING
    b.id, b.url, b.title, b.description, b.platform, b.cover_url,
    b.folder_id, b.ai_summary, b.ai_tags, b.user_tags,
    b.is_read, b.is_starred, b.is_in_trash, b.status,
    b.created_at, b.updated_at, b.starred_at;
END;
$$;

GRANT EXECUTE ON FUNCTION toggle_bookmark_starred(INTEGER, UUID) TO authenticated;

COMMENT ON FUNCTION toggle_bookmark_starred IS 'North Star P0: 原子切换书签收藏状态，解决竞态条件';

-- ============================================
-- 2. cascade_delete_folder - 级联删除文件夹（事务）
-- 确保原子性：书签移动 + 子文件夹删除 + 文件夹删除
-- ============================================
CREATE OR REPLACE FUNCTION cascade_delete_folder(
  p_folder_id INTEGER,
  p_user_id UUID
)
RETURNS TABLE (
  deleted_folder_count INTEGER,
  moved_bookmark_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_folders INTEGER := 0;
  v_moved_bookmarks INTEGER := 0;
  v_folder_exists BOOLEAN;
  v_is_system BOOLEAN;
BEGIN
  -- 检查文件夹是否存在且属于用户
  SELECT EXISTS(
    SELECT 1 FROM folders
    WHERE id = p_folder_id
      AND user_id = p_user_id
      AND deleted_at IS NULL
  ), is_system INTO v_folder_exists, v_is_system
  FROM folders
  WHERE id = p_folder_id;

  IF NOT v_folder_exists THEN
    RAISE EXCEPTION 'Folder not found or access denied';
  END IF;

  IF v_is_system THEN
    RAISE EXCEPTION 'Cannot delete system folder';
  END IF;

  -- 使用 CTE 递归获取所有后代文件夹
  WITH RECURSIVE folder_tree AS (
    -- 起始文件夹
    SELECT id FROM folders
    WHERE id = p_folder_id AND user_id = p_user_id AND deleted_at IS NULL

    UNION ALL

    -- 递归获取子文件夹
    SELECT f.id FROM folders f
    INNER JOIN folder_tree ft ON f.parent_id = ft.id
    WHERE f.user_id = p_user_id AND f.deleted_at IS NULL
  )
  -- 先移动所有书签到根目录
  UPDATE bookmarks
  SET folder_id = NULL, updated_at = NOW()
  WHERE folder_id IN (SELECT id FROM folder_tree)
    AND user_id = p_user_id
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_moved_bookmarks = ROW_COUNT;

  -- 软删除所有相关文件夹
  WITH RECURSIVE folder_tree AS (
    SELECT id FROM folders
    WHERE id = p_folder_id AND user_id = p_user_id AND deleted_at IS NULL

    UNION ALL

    SELECT f.id FROM folders f
    INNER JOIN folder_tree ft ON f.parent_id = ft.id
    WHERE f.user_id = p_user_id AND f.deleted_at IS NULL
  )
  UPDATE folders
  SET deleted_at = NOW(), updated_at = NOW()
  WHERE id IN (SELECT id FROM folder_tree)
    AND user_id = p_user_id;

  GET DIAGNOSTICS v_deleted_folders = ROW_COUNT;

  RETURN QUERY SELECT v_deleted_folders, v_moved_bookmarks;
END;
$$;

GRANT EXECUTE ON FUNCTION cascade_delete_folder(INTEGER, UUID) TO authenticated;

COMMENT ON FUNCTION cascade_delete_folder IS 'North Star P0: 级联删除文件夹（事务性），移动书签到根目录';

-- ============================================
-- 3. get_folder_descendant_ids - 获取所有后代文件夹 ID
-- 用于循环引用检测（性能优化）
-- ============================================
CREATE OR REPLACE FUNCTION get_folder_descendant_ids(
  p_folder_id INTEGER,
  p_user_id UUID
)
RETURNS INTEGER[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result INTEGER[];
BEGIN
  WITH RECURSIVE descendants AS (
    SELECT id FROM folders
    WHERE parent_id = p_folder_id
      AND user_id = p_user_id
      AND deleted_at IS NULL

    UNION ALL

    SELECT f.id FROM folders f
    INNER JOIN descendants d ON f.parent_id = d.id
    WHERE f.user_id = p_user_id AND f.deleted_at IS NULL
  )
  SELECT ARRAY_AGG(id) INTO result FROM descendants;

  RETURN COALESCE(result, ARRAY[]::INTEGER[]);
END;
$$;

GRANT EXECUTE ON FUNCTION get_folder_descendant_ids(INTEGER, UUID) TO authenticated;

COMMENT ON FUNCTION get_folder_descendant_ids IS 'North Star P0: 获取文件夹所有后代 ID（用于循环引用检测）';

-- ============================================
-- 完成
-- ============================================

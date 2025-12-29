-- Migration: North Star Phase 1 - Service Layer Support Functions
-- Version: 20251229100001
-- Description: 添加服务层所需的数据库函数和索引优化
--
-- 执行说明：
-- 1. 请在 Supabase 控制台执行此迁移
-- 2. 或使用 npx supabase migration up 命令
-- 3. 执行前请确保已备份数据

-- ============================================
-- 1. get_folders_with_counts 函数
-- 获取用户所有文件夹及其书签数量
-- ============================================
CREATE OR REPLACE FUNCTION get_folders_with_counts(p_user_id UUID)
RETURNS TABLE (
  id INTEGER,
  user_id UUID,
  name TEXT,
  parent_id INTEGER,
  folder_group TEXT,
  is_archived BOOLEAN,
  is_system BOOLEAN,
  system_type TEXT,
  sort_order INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  "bookmarkCount" BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.user_id,
    f.name,
    f.parent_id,
    f.folder_group,
    f.is_archived,
    f.is_system,
    f.system_type,
    f.sort_order,
    f.created_at,
    f.updated_at,
    f.deleted_at,
    COALESCE(
      (SELECT COUNT(*)::BIGINT
       FROM bookmarks b
       WHERE b.folder_id = f.id
         AND b.user_id = p_user_id
         AND b.deleted_at IS NULL
         AND b.is_in_trash = false),
      0
    ) AS "bookmarkCount"
  FROM folders f
  WHERE f.user_id = p_user_id
    AND f.deleted_at IS NULL
  ORDER BY f.sort_order NULLS LAST, f.name ASC;
END;
$$;

-- 授予执行权限
GRANT EXECUTE ON FUNCTION get_folders_with_counts(UUID) TO authenticated;

-- ============================================
-- 2. 索引优化
-- ============================================

-- 书签文件夹索引优化
CREATE INDEX IF NOT EXISTS idx_bookmarks_folder_user_active
ON bookmarks (folder_id, user_id)
WHERE deleted_at IS NULL AND is_in_trash = false;

-- 书签平台索引优化
CREATE INDEX IF NOT EXISTS idx_bookmarks_platform_user_active
ON bookmarks (platform, user_id)
WHERE deleted_at IS NULL AND is_in_trash = false;

-- 书签收藏索引优化
CREATE INDEX IF NOT EXISTS idx_bookmarks_starred_user_active
ON bookmarks (user_id, is_starred)
WHERE deleted_at IS NULL AND is_in_trash = false AND is_starred = true;

-- 书签未读索引优化
CREATE INDEX IF NOT EXISTS idx_bookmarks_unread_user_active
ON bookmarks (user_id, is_read)
WHERE deleted_at IS NULL AND is_in_trash = false AND is_read = false;

-- 文件夹父子关系索引
CREATE INDEX IF NOT EXISTS idx_folders_parent_user
ON folders (parent_id, user_id)
WHERE deleted_at IS NULL;

-- ============================================
-- 3. 清理函数（可选）
-- ============================================

-- 清理超过 30 天的回收站数据
CREATE OR REPLACE FUNCTION cleanup_old_trash(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM bookmarks
    WHERE is_in_trash = true
      AND trashed_at < NOW() - (days_to_keep || ' days')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;

-- 仅管理员可执行
GRANT EXECUTE ON FUNCTION cleanup_old_trash(INTEGER) TO service_role;

-- ============================================
-- 完成
-- ============================================
COMMENT ON FUNCTION get_folders_with_counts IS 'North Star Phase 1: 获取用户文件夹列表及每个文件夹的书签数量';
COMMENT ON FUNCTION cleanup_old_trash IS 'North Star Phase 1: 清理超期回收站数据的维护函数';

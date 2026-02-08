-- Migration: 添加基于书签ID的文件夹路径查询函数
-- Description: 支持在不预先获取 folder_id 的情况下直接通过 bookmark_id 查询文件夹路径，
--              使详情页可将此查询与其他查询并行执行，消除串行等待
-- Author: AI Assistant
-- Date: 2026-02-08

-- ============================================================================
-- 创建基于书签ID的文件夹路径查询函数
-- ============================================================================

CREATE OR REPLACE FUNCTION get_folder_path_by_bookmark(p_bookmark_id INTEGER)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  depth INTEGER
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  WITH bookmark_folder AS (
    SELECT folder_id
    FROM bookmarks
    WHERE id = p_bookmark_id
      AND deleted_at IS NULL
  )
  SELECT fp.id, fp.name, fp.depth
  FROM bookmark_folder bf
  CROSS JOIN LATERAL get_folder_path(bf.folder_id::INTEGER) fp
  WHERE bf.folder_id IS NOT NULL;
$$;

-- 添加函数注释
COMMENT ON FUNCTION get_folder_path_by_bookmark(INTEGER) IS
'通过书签ID直接获取其所在文件夹的完整路径。
内部复用 get_folder_path() 函数，支持与其他查询并行执行。
返回按层级排序的路径数组（根在前，目标在后）。
当书签无文件夹时返回空集。';

-- ============================================================================
-- 授予执行权限
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_folder_path_by_bookmark(INTEGER) TO authenticated;

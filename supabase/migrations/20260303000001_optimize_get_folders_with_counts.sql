-- Migration: Optimize get_folders_with_counts performance
-- Version: 20260303000001
-- Description: 将关联子查询替换为 LEFT JOIN + GROUP BY，消除 N+1 问题
--              原实现对每个文件夹执行独立 COUNT 子查询，导致 7+ 秒延迟

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
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
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
    COALESCE(b.cnt, 0) AS "bookmarkCount"
  FROM folders f
  LEFT JOIN (
    SELECT folder_id, COUNT(*)::BIGINT AS cnt
    FROM bookmarks
    WHERE user_id = p_user_id
      AND deleted_at IS NULL
      AND is_in_trash = false
    GROUP BY folder_id
  ) b ON b.folder_id = f.id
  WHERE f.user_id = p_user_id
    AND f.deleted_at IS NULL
  ORDER BY f.sort_order NULLS LAST, f.name ASC;
$$;

GRANT EXECUTE ON FUNCTION get_folders_with_counts(UUID) TO authenticated;

COMMENT ON FUNCTION get_folders_with_counts IS
  '获取用户文件夹列表及书签数量（LEFT JOIN 聚合，单次查询替代 N+1）';

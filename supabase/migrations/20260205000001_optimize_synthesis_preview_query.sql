/**
 * 优化综合预览查询性能
 *
 * 创建 RPC 函数解决 tag 模式下的 N+1 查询问题
 *
 * @version 1.0.0
 * @since 2026-02-05
 */

-- ============================================
-- RPC 函数：按标签获取书签（带文件夹信息）
-- ============================================

CREATE OR REPLACE FUNCTION get_bookmarks_by_tag_with_folder(
  p_user_id UUID,
  p_tag_name TEXT,
  p_offset INT DEFAULT 0,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  bookmark_id INT,
  title TEXT,
  url TEXT,
  platform TEXT,
  ai_summary TEXT,
  created_at TIMESTAMPTZ,
  folder_id INT,
  folder_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
BEGIN
  RETURN QUERY
  SELECT
    b.id AS bookmark_id,
    b.title,
    b.url,
    b.platform,
    b.ai_summary,
    b.created_at,
    b.folder_id,
    f.name AS folder_name
  FROM bookmarks b
  INNER JOIN bookmark_tags bt ON bt.bookmark_id = b.id
  LEFT JOIN folders f ON f.id = b.folder_id
  WHERE
    b.user_id = p_user_id AND
    bt.user_id = p_user_id AND
    bt.tag_name = p_tag_name AND
    b.deleted_at IS NULL
  ORDER BY b.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ============================================
-- 添加注释
-- ============================================

COMMENT ON FUNCTION get_bookmarks_by_tag_with_folder IS
'按标签获取用户书签列表，包含文件夹信息，避免 N+1 查询';

-- ============================================
-- 授权给 authenticated 用户
-- ============================================

GRANT EXECUTE ON FUNCTION get_bookmarks_by_tag_with_folder TO authenticated;
GRANT EXECUTE ON FUNCTION get_bookmarks_by_tag_with_folder TO service_role;

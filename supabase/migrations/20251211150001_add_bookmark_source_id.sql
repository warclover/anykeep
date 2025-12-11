-- ===========================================
-- V4.2 补充迁移: 为 bookmarks 表添加 source_id 字段
-- ===========================================
-- 用于关联 source_profiles 表，支持来源画像功能

-- ============================================================================
-- 1. 添加 source_id 字段
-- ============================================================================

ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS source_id VARCHAR(255);

COMMENT ON COLUMN public.bookmarks.source_id
IS 'V4.2: 来源标识符（如公众号ID、域名等），关联 source_profiles 表';

-- ============================================================================
-- 2. 添加索引：加速来源查询
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bookmarks_source_id
ON public.bookmarks(user_id, source_id)
WHERE source_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON INDEX idx_bookmarks_source_id IS
'V4.2: 来源ID索引，用于按来源筛选书签';

-- ============================================================================
-- 3. 来源名称字段（如果不存在）
-- ============================================================================

-- source_name 字段已存在于现有表中，无需添加

-- ============================================================================
-- 4. 基于来源的书签统计函数
-- ============================================================================

CREATE OR REPLACE FUNCTION get_bookmarks_by_source(
  p_user_id UUID,
  p_source_id VARCHAR(255),
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  bookmark_id BIGINT,
  title TEXT,
  url TEXT,
  folder_id BIGINT,
  folder_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id as bookmark_id,
    b.title::TEXT,
    b.url::TEXT,
    b.folder_id,
    f.name::TEXT as folder_name,
    b.created_at
  FROM bookmarks b
  LEFT JOIN folders f ON f.id = b.folder_id AND f.deleted_at IS NULL
  WHERE b.user_id = p_user_id
    AND b.source_id = p_source_id
    AND b.deleted_at IS NULL
  ORDER BY b.created_at DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_bookmarks_by_source IS
'V4.2: 获取指定来源的所有书签';

GRANT EXECUTE ON FUNCTION get_bookmarks_by_source(UUID, VARCHAR, INT)
TO authenticated;

-- ============================================================================
-- 5. 来源统计函数
-- ============================================================================

CREATE OR REPLACE FUNCTION get_source_statistics(
  p_user_id UUID
)
RETURNS TABLE (
  source_id VARCHAR(255),
  source_name TEXT,
  bookmark_count BIGINT,
  folder_distribution JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.source_id,
    MAX(b.source_name)::TEXT as source_name,
    COUNT(*)::BIGINT as bookmark_count,
    jsonb_object_agg(
      COALESCE(f.name, '待整理'),
      folder_counts.cnt
    ) as folder_distribution
  FROM bookmarks b
  LEFT JOIN folders f ON f.id = b.folder_id AND f.deleted_at IS NULL
  LEFT JOIN LATERAL (
    SELECT b2.folder_id, COUNT(*) as cnt
    FROM bookmarks b2
    WHERE b2.user_id = p_user_id
      AND b2.source_id = b.source_id
      AND b2.deleted_at IS NULL
    GROUP BY b2.folder_id
  ) folder_counts ON folder_counts.folder_id = b.folder_id
  WHERE b.user_id = p_user_id
    AND b.source_id IS NOT NULL
    AND b.deleted_at IS NULL
  GROUP BY b.source_id
  ORDER BY bookmark_count DESC;
END;
$$;

COMMENT ON FUNCTION get_source_statistics IS
'V4.2: 获取用户所有来源的统计信息';

GRANT EXECUTE ON FUNCTION get_source_statistics(UUID)
TO authenticated;

-- ============================================================================
-- 完成
-- ============================================================================

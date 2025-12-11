-- ===========================================
-- V4.2 Phase 2.3: 多向量表征系统
-- ===========================================
-- 为 bookmarks 表添加多向量字段，支持：
-- - title_embedding: 标题向量（快速路径匹配）
-- - tag_embedding: 标签向量（标签语义匹配）
-- - embedding 保留为内容/摘要向量

-- 确保 pgvector 扩展已启用
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 设置 search_path 以包含 extensions schema
SET search_path TO public, extensions;

-- ============================================================================
-- 1. 标题向量字段
-- ============================================================================

ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS title_embedding vector(1024);

COMMENT ON COLUMN public.bookmarks.title_embedding
IS '标题向量：基于标题文本生成的轻量级向量，用于快速路径匹配';

-- ============================================================================
-- 2. 标签向量字段
-- ============================================================================

ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS tag_embedding vector(1024);

COMMENT ON COLUMN public.bookmarks.tag_embedding
IS '标签向量：基于标签组合生成的语义向量，用于标签相似度匹配';

-- ============================================================================
-- 3. 向量版本号（用于追踪迁移和重新生成）
-- ============================================================================

ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS embedding_version INT DEFAULT 1;

COMMENT ON COLUMN public.bookmarks.embedding_version
IS '向量版本号：1=单向量，2=多向量（title+content+tag）';

-- ============================================================================
-- 4. 向量生成时间戳
-- ============================================================================

ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS title_embedding_at TIMESTAMPTZ;

COMMENT ON COLUMN public.bookmarks.title_embedding_at
IS '标题向量生成时间';

ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS tag_embedding_at TIMESTAMPTZ;

COMMENT ON COLUMN public.bookmarks.tag_embedding_at
IS '标签向量生成时间';

-- ============================================================================
-- 5. 标题向量 HNSW 索引（用于快速路径）
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bookmarks_title_embedding_hnsw
ON public.bookmarks
USING hnsw (title_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE title_embedding IS NOT NULL AND deleted_at IS NULL;

COMMENT ON INDEX idx_bookmarks_title_embedding_hnsw IS
'标题向量 HNSW 索引，用于快速路径的轻量级匹配';

-- ============================================================================
-- 6. 标签向量 HNSW 索引
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bookmarks_tag_embedding_hnsw
ON public.bookmarks
USING hnsw (tag_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE tag_embedding IS NOT NULL AND deleted_at IS NULL;

COMMENT ON INDEX idx_bookmarks_tag_embedding_hnsw IS
'标签向量 HNSW 索引，用于基于标签的语义搜索';

-- ============================================================================
-- 7. 版本索引（用于批量迁移查询）
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bookmarks_embedding_version
ON public.bookmarks(user_id, embedding_version)
WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_bookmarks_embedding_version IS
'向量版本索引，用于查找需要多向量迁移的书签';

-- ============================================================================
-- 8. 基于标题向量的快速搜索函数
-- ============================================================================

CREATE OR REPLACE FUNCTION search_bookmarks_by_title_vector(
  p_user_id UUID,
  p_query_embedding vector(1024),
  p_limit INT DEFAULT 5,
  p_min_similarity FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  bookmark_id BIGINT,
  title TEXT,
  folder_id BIGINT,
  folder_name TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id as bookmark_id,
    b.title::TEXT,
    b.folder_id,
    f.name::TEXT as folder_name,
    ROUND((1 - (b.title_embedding <=> p_query_embedding))::NUMERIC, 4)::FLOAT as similarity
  FROM bookmarks b
  LEFT JOIN folders f ON f.id = b.folder_id AND f.deleted_at IS NULL
  WHERE b.user_id = p_user_id
    AND b.deleted_at IS NULL
    AND b.title_embedding IS NOT NULL
    AND (1 - (b.title_embedding <=> p_query_embedding)) >= p_min_similarity
  ORDER BY similarity DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION search_bookmarks_by_title_vector IS
'V4.2: 基于标题向量的快速搜索，用于快速路径匹配';

GRANT EXECUTE ON FUNCTION search_bookmarks_by_title_vector(UUID, vector, INT, FLOAT)
TO authenticated;

-- ============================================================================
-- 9. 基于标签向量的搜索函数
-- ============================================================================

CREATE OR REPLACE FUNCTION search_bookmarks_by_tag_vector(
  p_user_id UUID,
  p_query_embedding vector(1024),
  p_limit INT DEFAULT 10,
  p_min_similarity FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  bookmark_id BIGINT,
  title TEXT,
  ai_tags TEXT[],
  user_tags TEXT[],
  folder_id BIGINT,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id as bookmark_id,
    b.title::TEXT,
    b.ai_tags,
    b.user_tags,
    b.folder_id,
    ROUND((1 - (b.tag_embedding <=> p_query_embedding))::NUMERIC, 4)::FLOAT as similarity
  FROM bookmarks b
  WHERE b.user_id = p_user_id
    AND b.deleted_at IS NULL
    AND b.tag_embedding IS NOT NULL
    AND (1 - (b.tag_embedding <=> p_query_embedding)) >= p_min_similarity
  ORDER BY similarity DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION search_bookmarks_by_tag_vector IS
'V4.2: 基于标签向量的语义搜索';

GRANT EXECUTE ON FUNCTION search_bookmarks_by_tag_vector(UUID, vector, INT, FLOAT)
TO authenticated;

-- ============================================================================
-- 10. 多向量融合搜索函数
-- ============================================================================

CREATE OR REPLACE FUNCTION search_bookmarks_multi_vector(
  p_user_id UUID,
  p_query_embedding vector(1024),
  p_title_weight FLOAT DEFAULT 0.3,
  p_content_weight FLOAT DEFAULT 0.5,
  p_tag_weight FLOAT DEFAULT 0.2,
  p_limit INT DEFAULT 10,
  p_min_similarity FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  bookmark_id BIGINT,
  title TEXT,
  folder_id BIGINT,
  folder_name TEXT,
  title_similarity FLOAT,
  content_similarity FLOAT,
  tag_similarity FLOAT,
  weighted_similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id as bookmark_id,
    b.title::TEXT,
    b.folder_id,
    f.name::TEXT as folder_name,
    ROUND(COALESCE(1 - (b.title_embedding <=> p_query_embedding), 0)::NUMERIC, 4)::FLOAT as title_similarity,
    ROUND(COALESCE(1 - (b.embedding <=> p_query_embedding), 0)::NUMERIC, 4)::FLOAT as content_similarity,
    ROUND(COALESCE(1 - (b.tag_embedding <=> p_query_embedding), 0)::NUMERIC, 4)::FLOAT as tag_similarity,
    ROUND((
      COALESCE(1 - (b.title_embedding <=> p_query_embedding), 0) * p_title_weight +
      COALESCE(1 - (b.embedding <=> p_query_embedding), 0) * p_content_weight +
      COALESCE(1 - (b.tag_embedding <=> p_query_embedding), 0) * p_tag_weight
    )::NUMERIC, 4)::FLOAT as weighted_similarity
  FROM bookmarks b
  LEFT JOIN folders f ON f.id = b.folder_id AND f.deleted_at IS NULL
  WHERE b.user_id = p_user_id
    AND b.deleted_at IS NULL
    AND (
      b.title_embedding IS NOT NULL OR
      b.embedding IS NOT NULL OR
      b.tag_embedding IS NOT NULL
    )
  ORDER BY weighted_similarity DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION search_bookmarks_multi_vector IS
'V4.2: 多向量融合搜索，支持自定义权重的标题/内容/标签向量组合';

GRANT EXECUTE ON FUNCTION search_bookmarks_multi_vector(UUID, vector, FLOAT, FLOAT, FLOAT, INT, FLOAT)
TO authenticated;

-- ============================================================================
-- 11. 获取待迁移书签（用于存量数据迁移脚本）
-- ============================================================================

CREATE OR REPLACE FUNCTION get_bookmarks_pending_multi_vector(
  p_user_id UUID,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  bookmark_id BIGINT,
  title TEXT,
  ai_summary TEXT,
  ai_tags TEXT[],
  user_tags TEXT[],
  has_title_embedding BOOLEAN,
  has_tag_embedding BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id as bookmark_id,
    b.title::TEXT,
    b.ai_summary::TEXT,
    b.ai_tags,
    b.user_tags,
    b.title_embedding IS NOT NULL as has_title_embedding,
    b.tag_embedding IS NOT NULL as has_tag_embedding
  FROM bookmarks b
  WHERE b.user_id = p_user_id
    AND b.deleted_at IS NULL
    AND b.embedding_version < 2
    AND (b.title_embedding IS NULL OR b.tag_embedding IS NULL)
  ORDER BY b.created_at DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_bookmarks_pending_multi_vector IS
'V4.2: 获取待多向量迁移的书签列表';

GRANT EXECUTE ON FUNCTION get_bookmarks_pending_multi_vector(UUID, INT)
TO authenticated;

-- ============================================================================
-- 完成
-- ============================================================================

-- Migration: 20251220000003_fix_md_search_semantic_function.sql
-- 修复 MD 收藏语义搜索函数，补充返回字段

-- 删除旧函数
DROP FUNCTION IF EXISTS search_md_collections_semantic(vector(1024), UUID, FLOAT, INT);

-- 创建新函数，返回完整字段
CREATE OR REPLACE FUNCTION search_md_collections_semantic(
  query_embedding vector(1024),
  p_user_id UUID,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 20
)
RETURNS TABLE (
  id BIGINT,
  title VARCHAR(500),
  ai_summary TEXT,
  ai_tags TEXT[],
  content_type VARCHAR(50),
  word_count INTEGER,
  reading_time_minutes INTEGER,
  folder_id BIGINT,
  created_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mc.id,
    mc.title,
    mc.ai_summary,
    mc.ai_tags,
    mc.content_type,
    mc.word_count,
    mc.reading_time_minutes,
    mc.folder_id,
    mc.created_at,
    (1 - (mc.embedding <=> query_embedding))::FLOAT AS similarity
  FROM md_collections mc
  WHERE mc.user_id = p_user_id
    AND mc.deleted_at IS NULL
    AND mc.embedding IS NOT NULL
    AND (1 - (mc.embedding <=> query_embedding)) > match_threshold
  ORDER BY mc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION search_md_collections_semantic(vector(1024), UUID, FLOAT, INT)
IS 'MD 收藏语义搜索函数，基于向量相似度返回匹配结果';

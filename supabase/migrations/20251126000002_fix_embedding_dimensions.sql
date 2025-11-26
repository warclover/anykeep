-- ===========================================
-- 修复向量维度 (1536 -> 1024)
-- ===========================================
-- 原因: 阿里云百炼 text-embedding-v3 只支持 64, 128, 256, 512, 768, 1024 维度
-- 日期: 2025-11-26

-- -------------------------------------------
-- 1. 修改 embedding 字段类型
-- -------------------------------------------

-- 先删除依赖的索引
DROP INDEX IF EXISTS idx_bookmarks_embedding_hnsw;

-- 修改字段类型 (从 vector(1536) 改为 vector(1024))
ALTER TABLE bookmarks
ALTER COLUMN embedding TYPE vector(1024);

-- 重建 HNSW 索引
CREATE INDEX idx_bookmarks_embedding_hnsw
ON public.bookmarks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

COMMENT ON INDEX idx_bookmarks_embedding_hnsw IS
'HNSW 向量索引 (1024维)，用于高效近似最近邻搜索';

-- -------------------------------------------
-- 2. 更新语义搜索函数
-- -------------------------------------------

-- 删除旧函数
DROP FUNCTION IF EXISTS search_bookmarks_semantic(vector, uuid, float, int);
DROP FUNCTION IF EXISTS search_bookmarks_semantic(vector, uuid, double precision, integer);

-- 创建新函数 (1024维)
CREATE OR REPLACE FUNCTION search_bookmarks_semantic(
  query_embedding vector(1024),
  p_user_id uuid,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id bigint,
  title varchar(500),
  url text,
  description text,
  cover_url text,
  platform varchar(50),
  ai_summary text,
  ai_tags text[],
  folder_id bigint,
  author varchar(200),
  publish_time timestamptz,
  content_type varchar(50),
  user_tags text[],
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.title,
    b.url,
    b.description,
    b.cover_url,
    b.platform,
    b.ai_summary,
    b.ai_tags,
    b.folder_id,
    b.author,
    b.publish_time,
    b.content_type,
    b.user_tags,
    b.notes,
    b.created_at,
    b.updated_at,
    (1 - (b.embedding <=> query_embedding))::float as similarity
  FROM bookmarks b
  WHERE b.user_id = p_user_id
    AND b.deleted_at IS NULL
    AND b.embedding IS NOT NULL
    AND (1 - (b.embedding <=> query_embedding)) > match_threshold
  ORDER BY b.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_bookmarks_semantic IS
'语义搜索书签 (1024维向量)。基于向量余弦相似度，返回相似度 > match_threshold 的结果。';

-- 授权
GRANT EXECUTE ON FUNCTION search_bookmarks_semantic TO authenticated;

-- 完成

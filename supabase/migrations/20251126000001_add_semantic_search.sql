-- ===========================================
-- AnyKeep 语义搜索功能迁移
-- ===========================================
-- 版本: 1.0.0
-- 日期: 2025-11-26
-- 说明: 添加向量搜索函数和 HNSW 索引

-- -------------------------------------------
-- 1. 创建语义搜索函数
-- -------------------------------------------

CREATE OR REPLACE FUNCTION search_bookmarks_semantic(
  query_embedding vector(1536),
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

-- 添加函数注释
COMMENT ON FUNCTION search_bookmarks_semantic IS
'语义搜索书签。基于向量余弦相似度，返回相似度 > match_threshold 的结果，按相似度降序排列。';

-- -------------------------------------------
-- 2. 创建 HNSW 向量索引
-- -------------------------------------------

-- 删除可能存在的旧索引
DROP INDEX IF EXISTS idx_bookmarks_embedding;
DROP INDEX IF EXISTS idx_bookmarks_embedding_hnsw;

-- 创建 HNSW 索引（高性能近似最近邻搜索）
-- 参数说明：
-- m = 16: 每个节点的最大连接数（默认值，适合大多数场景）
-- ef_construction = 64: 构建索引时的搜索深度（值越大精度越高但构建越慢）
CREATE INDEX idx_bookmarks_embedding_hnsw
ON public.bookmarks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 添加索引注释
COMMENT ON INDEX idx_bookmarks_embedding_hnsw IS
'HNSW 向量索引，用于高效近似最近邻搜索。参数: m=16 (图连接数), ef_construction=64 (构建精度)';

-- -------------------------------------------
-- 3. 创建向量统计视图
-- -------------------------------------------

CREATE OR REPLACE VIEW embedding_stats AS
SELECT
  COUNT(*) as total_bookmarks,
  COUNT(embedding) as bookmarks_with_embedding,
  COUNT(*) - COUNT(embedding) as bookmarks_without_embedding,
  CASE
    WHEN COUNT(*) > 0 THEN ROUND(100.0 * COUNT(embedding) / COUNT(*), 2)
    ELSE 0
  END as embedding_coverage_percent
FROM bookmarks
WHERE deleted_at IS NULL;

COMMENT ON VIEW embedding_stats IS
'向量嵌入统计视图，用于监控向量覆盖率';

-- -------------------------------------------
-- 4. 授权
-- -------------------------------------------

-- 授予 authenticated 用户调用函数的权限
GRANT EXECUTE ON FUNCTION search_bookmarks_semantic TO authenticated;

-- 授予查看统计视图的权限
GRANT SELECT ON embedding_stats TO authenticated;

-- -------------------------------------------
-- 5. 添加 RLS 策略（如需要）
-- -------------------------------------------
-- 注意：函数使用 SECURITY DEFINER，已在函数内部通过 WHERE 子句过滤用户数据

-- 完成

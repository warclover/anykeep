-- ===========================================
-- AnyKeep 混合检索升级
-- ===========================================
-- 版本: 1.0.0
-- 日期: 2025-12-29
-- Phase: North Star Phase 3 - AI 架构标准化
-- 说明:
--   1. 创建 RRF (Reciprocal Rank Fusion) 混合搜索函数
--   2. 结合语义搜索 + 全文搜索 + 时间衰减
--   3. 提供可调节的权重参数

-- -------------------------------------------
-- 1. 创建混合搜索函数
-- -------------------------------------------

CREATE OR REPLACE FUNCTION hybrid_search(
  p_user_id UUID,
  p_query TEXT,
  p_query_embedding vector(1024),
  p_match_count INT DEFAULT 20,
  p_semantic_weight FLOAT DEFAULT 0.6,
  p_keyword_weight FLOAT DEFAULT 0.3,
  p_recency_weight FLOAT DEFAULT 0.1,
  p_match_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  id BIGINT,
  title VARCHAR(500),
  url TEXT,
  description TEXT,
  cover_url TEXT,
  platform VARCHAR(50),
  ai_summary TEXT,
  ai_tags TEXT[],
  folder_id BIGINT,
  author VARCHAR(200),
  publish_time TIMESTAMPTZ,
  content_type VARCHAR(50),
  user_tags TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  score FLOAT,
  semantic_score FLOAT,
  keyword_score FLOAT,
  recency_score FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_rrf_k INT := 60;  -- RRF 常数 k，常用值为 60
BEGIN
  RETURN QUERY
  WITH
  -- 语义搜索结果（向量相似度）
  semantic AS (
    SELECT
      b.id,
      (1 - (b.embedding <=> p_query_embedding))::FLOAT AS semantic_score,
      ROW_NUMBER() OVER (ORDER BY b.embedding <=> p_query_embedding) AS semantic_rank
    FROM bookmarks b
    WHERE b.user_id = p_user_id
      AND b.deleted_at IS NULL
      AND b.embedding IS NOT NULL
      AND (1 - (b.embedding <=> p_query_embedding)) > p_match_threshold
    ORDER BY b.embedding <=> p_query_embedding
    LIMIT p_match_count * 3  -- 取更多候选以便融合
  ),

  -- 关键词搜索结果（全文匹配）
  keyword AS (
    SELECT
      b.id,
      ts_rank(b.search_vector, websearch_to_tsquery('simple', p_query))::FLOAT AS keyword_score,
      ROW_NUMBER() OVER (ORDER BY ts_rank(b.search_vector, websearch_to_tsquery('simple', p_query)) DESC) AS keyword_rank
    FROM bookmarks b
    WHERE b.user_id = p_user_id
      AND b.deleted_at IS NULL
      AND b.search_vector @@ websearch_to_tsquery('simple', p_query)
    ORDER BY ts_rank(b.search_vector, websearch_to_tsquery('simple', p_query)) DESC
    LIMIT p_match_count * 3
  ),

  -- RRF 融合算法
  -- 公式: score = sum(weight / (k + rank)) 对每个检索系统
  combined AS (
    SELECT
      COALESCE(s.id, k.id) AS id,
      -- RRF 融合分数
      (
        p_semantic_weight * COALESCE(1.0 / (v_rrf_k + s.semantic_rank), 0) +
        p_keyword_weight * COALESCE(1.0 / (v_rrf_k + k.keyword_rank), 0) +
        p_recency_weight * (1.0 / (1 + EXTRACT(EPOCH FROM (NOW() - bm.created_at)) / 86400.0 / 30.0))
      ) AS combined_score,
      COALESCE(s.semantic_score, 0) AS semantic_score,
      COALESCE(k.keyword_score, 0) AS keyword_score,
      -- 时间衰减分数：30天内为高分，逐渐衰减
      (1.0 / (1 + EXTRACT(EPOCH FROM (NOW() - bm.created_at)) / 86400.0 / 30.0))::FLOAT AS recency_score
    FROM semantic s
    FULL OUTER JOIN keyword k ON s.id = k.id
    JOIN bookmarks bm ON bm.id = COALESCE(s.id, k.id)
  )

  -- 返回最终结果
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
    c.combined_score AS score,
    c.semantic_score,
    c.keyword_score,
    c.recency_score
  FROM combined c
  JOIN bookmarks b ON b.id = c.id
  ORDER BY c.combined_score DESC
  LIMIT p_match_count;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION hybrid_search IS
'混合检索函数 (RRF 融合)：
- 结合语义搜索（向量相似度）、关键词搜索（全文匹配）、时间衰减
- 使用 RRF (Reciprocal Rank Fusion) 算法融合多个检索源
- 可调节各因素权重：
  - p_semantic_weight: 语义权重 (默认 0.6)
  - p_keyword_weight: 关键词权重 (默认 0.3)
  - p_recency_weight: 时间权重 (默认 0.1)
- 返回综合得分及各维度分数用于调试';

-- -------------------------------------------
-- 2. 授予权限
-- -------------------------------------------

GRANT EXECUTE ON FUNCTION hybrid_search TO authenticated;

-- -------------------------------------------
-- 3. 创建简化版混合搜索（用于快速调用）
-- -------------------------------------------

CREATE OR REPLACE FUNCTION hybrid_search_simple(
  p_user_id UUID,
  p_query TEXT,
  p_query_embedding vector(1024),
  p_match_count INT DEFAULT 10
)
RETURNS TABLE (
  id BIGINT,
  title VARCHAR(500),
  url TEXT,
  ai_summary TEXT,
  platform VARCHAR(50),
  score FLOAT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    h.id,
    h.title,
    h.url,
    h.ai_summary,
    h.platform,
    h.score
  FROM hybrid_search(
    p_user_id,
    p_query,
    p_query_embedding,
    p_match_count,
    0.6,  -- semantic_weight
    0.3,  -- keyword_weight
    0.1   -- recency_weight
  ) h;
$$;

COMMENT ON FUNCTION hybrid_search_simple IS
'简化版混合检索函数：使用默认权重，返回精简结果';

GRANT EXECUTE ON FUNCTION hybrid_search_simple TO authenticated;

-- -------------------------------------------
-- 4. 创建搜索性能分析函数（可选）
-- -------------------------------------------

CREATE OR REPLACE FUNCTION analyze_search_distribution(
  p_user_id UUID
)
RETURNS TABLE (
  total_bookmarks BIGINT,
  with_embedding BIGINT,
  with_search_vector BIGINT,
  embedding_coverage FLOAT,
  fts_coverage FLOAT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COUNT(*)::BIGINT AS total_bookmarks,
    COUNT(embedding)::BIGINT AS with_embedding,
    COUNT(search_vector)::BIGINT AS with_search_vector,
    (100.0 * COUNT(embedding) / NULLIF(COUNT(*), 0))::FLOAT AS embedding_coverage,
    (100.0 * COUNT(search_vector) / NULLIF(COUNT(*), 0))::FLOAT AS fts_coverage
  FROM bookmarks
  WHERE user_id = p_user_id
    AND deleted_at IS NULL;
$$;

COMMENT ON FUNCTION analyze_search_distribution IS
'分析用户书签的搜索覆盖率：向量嵌入覆盖率和全文搜索覆盖率';

GRANT EXECUTE ON FUNCTION analyze_search_distribution TO authenticated;

-- 完成

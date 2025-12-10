-- Phase 4.1: RAG 向量搜索 RPC 函数
-- 用于 AI 对话功能的书签检索
-- @version 1.0.0
-- @since 2025-12-09

-- 确保 pgvector 扩展已启用
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 设置 search_path 以包含 extensions schema（使 vector 类型可用）
SET search_path TO public, extensions;

/**
 * search_bookmarks_by_embedding - 基于向量相似度搜索书签
 *
 * 用于 RAG 检索，找到与用户查询语义相似的书签
 *
 * @param query_embedding - 查询文本的向量表示（1024 维）
 * @param match_threshold - 最小相似度阈值（默认 0.5）
 * @param match_count - 返回结果数量限制（默认 5）
 * @param p_user_id - 用户 ID
 * @param p_folder_id - 可选的文件夹 ID 过滤
 *
 * @returns 相似书签列表，按相似度降序排列
 */
CREATE OR REPLACE FUNCTION public.search_bookmarks_by_embedding(
  query_embedding vector(1024),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5,
  p_user_id UUID DEFAULT NULL,
  p_folder_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  title TEXT,
  url TEXT,
  description TEXT,
  ai_summary TEXT,
  ai_tags TEXT[],
  platform TEXT,
  folder_id BIGINT,
  folder_name TEXT,
  created_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.title,
    b.url,
    b.description,
    b.ai_summary,
    b.ai_tags,
    b.platform,
    b.folder_id,
    f.name AS folder_name,
    b.created_at,
    (1 - (b.embedding <=> query_embedding))::FLOAT AS similarity
  FROM bookmarks b
  LEFT JOIN folders f ON f.id = b.folder_id AND f.user_id = p_user_id
  WHERE b.user_id = p_user_id
    AND b.embedding IS NOT NULL
    -- 可选：文件夹过滤
    AND (p_folder_id IS NULL OR b.folder_id = p_folder_id)
    -- 相似度阈值过滤
    AND (1 - (b.embedding <=> query_embedding)) >= match_threshold
  ORDER BY b.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION public.search_bookmarks_by_embedding IS
'基于向量相似度搜索书签，用于 RAG 检索和 AI 对话功能';

-- 授予权限
GRANT EXECUTE ON FUNCTION public.search_bookmarks_by_embedding TO authenticated;


/**
 * search_bookmarks_hybrid - 混合搜索（向量 + 关键词）
 *
 * 结合向量相似度和关键词匹配的混合搜索
 * 适用于需要精确匹配和语义理解的场景
 *
 * @param query_text - 原始查询文本
 * @param query_embedding - 查询文本的向量表示
 * @param p_user_id - 用户 ID
 * @param match_count - 返回结果数量限制
 * @param vector_weight - 向量相似度权重（0-1，默认 0.7）
 * @param keyword_weight - 关键词匹配权重（0-1，默认 0.3）
 *
 * @returns 搜索结果，按综合得分排序
 */
CREATE OR REPLACE FUNCTION public.search_bookmarks_hybrid(
  query_text TEXT,
  query_embedding vector(1024),
  p_user_id UUID,
  match_count INT DEFAULT 10,
  vector_weight FLOAT DEFAULT 0.7,
  keyword_weight FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id BIGINT,
  title TEXT,
  url TEXT,
  ai_summary TEXT,
  folder_name TEXT,
  vector_score FLOAT,
  keyword_score FLOAT,
  combined_score FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  search_query tsquery;
BEGIN
  -- 将查询文本转换为全文搜索查询
  -- 使用 simple 配置以支持中文（假设已配置）
  search_query := plainto_tsquery('simple', query_text);

  RETURN QUERY
  WITH scored_bookmarks AS (
    SELECT
      b.id,
      b.title,
      b.url,
      b.ai_summary,
      f.name AS folder_name,
      -- 向量相似度得分
      CASE
        WHEN b.embedding IS NOT NULL
        THEN (1 - (b.embedding <=> query_embedding))::FLOAT
        ELSE 0
      END AS v_score,
      -- 关键词匹配得分（基于标题和摘要）
      CASE
        WHEN to_tsvector('simple', COALESCE(b.title, '') || ' ' || COALESCE(b.ai_summary, '')) @@ search_query
        THEN ts_rank(
          to_tsvector('simple', COALESCE(b.title, '') || ' ' || COALESCE(b.ai_summary, '')),
          search_query
        )::FLOAT
        ELSE 0
      END AS k_score
    FROM bookmarks b
    LEFT JOIN folders f ON f.id = b.folder_id AND f.user_id = p_user_id
    WHERE b.user_id = p_user_id
  )
  SELECT
    sb.id,
    sb.title,
    sb.url,
    sb.ai_summary,
    sb.folder_name,
    sb.v_score AS vector_score,
    sb.k_score AS keyword_score,
    (sb.v_score * vector_weight + sb.k_score * keyword_weight)::FLOAT AS combined_score
  FROM scored_bookmarks sb
  WHERE sb.v_score > 0.3 OR sb.k_score > 0  -- 至少有一种匹配
  ORDER BY (sb.v_score * vector_weight + sb.k_score * keyword_weight) DESC
  LIMIT match_count;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION public.search_bookmarks_hybrid IS
'混合搜索：结合向量相似度和关键词匹配，适用于 AI 对话的上下文检索';

-- 授予权限
GRANT EXECUTE ON FUNCTION public.search_bookmarks_hybrid TO authenticated;

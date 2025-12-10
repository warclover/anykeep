-- Phase 2.1: 相关书签推荐 RPC 函数
-- 基于向量相似度查询相关内容
-- @version 1.0.0
-- @since 2025-12-09

-- 确保 pgvector 扩展已启用
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 设置 search_path 以包含 extensions schema（使 vector 类型可用）
SET search_path TO public, extensions;

/**
 * find_related_bookmarks - 查询与指定书签相似的其他书签
 *
 * 使用向量距离（余弦相似度）查找语义相关的书签
 * 支持跨文件夹查询，帮助用户发现知识连接
 *
 * @param p_bookmark_id - 源书签 ID
 * @param p_user_id - 用户 ID（用于 RLS）
 * @param p_limit - 返回结果数量限制（默认 5）
 * @param p_min_similarity - 最小相似度阈值（默认 0.5）
 * @param p_exclude_same_folder - 是否排除同文件夹书签（默认 false）
 *
 * @returns 相关书签列表，按相似度降序排列
 */
CREATE OR REPLACE FUNCTION public.find_related_bookmarks(
  p_bookmark_id BIGINT,
  p_user_id UUID,
  p_limit INT DEFAULT 5,
  p_min_similarity FLOAT DEFAULT 0.5,
  p_exclude_same_folder BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id BIGINT,
  title TEXT,
  url TEXT,
  description TEXT,
  similarity FLOAT,
  folder_id BIGINT,
  folder_name TEXT,
  platform TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_source_embedding vector(1024);
  v_source_folder_id BIGINT;
BEGIN
  -- 获取源书签的 embedding 和文件夹
  SELECT b.embedding, b.folder_id
  INTO v_source_embedding, v_source_folder_id
  FROM bookmarks b
  WHERE b.id = p_bookmark_id
    AND b.user_id = p_user_id;

  -- 如果源书签不存在或没有 embedding，返回空结果
  IF v_source_embedding IS NULL THEN
    RETURN;
  END IF;

  -- 查询相关书签
  RETURN QUERY
  SELECT
    b.id,
    b.title,
    b.url,
    b.description,
    (1 - (b.embedding <=> v_source_embedding))::FLOAT AS similarity,
    b.folder_id,
    f.name AS folder_name,
    b.platform,
    b.created_at
  FROM bookmarks b
  LEFT JOIN folders f ON f.id = b.folder_id AND f.user_id = p_user_id
  WHERE b.user_id = p_user_id
    AND b.id != p_bookmark_id
    AND b.embedding IS NOT NULL
    -- 可选：排除同文件夹的书签
    AND (NOT p_exclude_same_folder OR b.folder_id IS DISTINCT FROM v_source_folder_id)
    -- 相似度阈值过滤
    AND (1 - (b.embedding <=> v_source_embedding)) >= p_min_similarity
  ORDER BY b.embedding <=> v_source_embedding
  LIMIT p_limit;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION public.find_related_bookmarks IS
'查询与指定书签语义相似的其他书签，用于相关内容推荐功能';

-- 授予权限
GRANT EXECUTE ON FUNCTION public.find_related_bookmarks TO authenticated;


/**
 * find_cross_folder_connections - 查询文件夹之间的内容连接
 *
 * 发现不同文件夹中语义相关的书签对
 * 用于知识图谱和文件夹关联分析
 *
 * @param p_user_id - 用户 ID
 * @param p_folder_id - 可选的指定文件夹（不指定则分析所有文件夹）
 * @param p_min_similarity - 最小相似度阈值（默认 0.7）
 * @param p_limit - 返回结果数量限制（默认 20）
 *
 * @returns 跨文件夹的相关书签对
 */
CREATE OR REPLACE FUNCTION public.find_cross_folder_connections(
  p_user_id UUID,
  p_folder_id BIGINT DEFAULT NULL,
  p_min_similarity FLOAT DEFAULT 0.7,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  source_bookmark_id BIGINT,
  source_title TEXT,
  source_folder_id BIGINT,
  source_folder_name TEXT,
  target_bookmark_id BIGINT,
  target_title TEXT,
  target_folder_id BIGINT,
  target_folder_name TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  WITH bookmark_pairs AS (
    SELECT
      b1.id AS src_id,
      b1.title AS src_title,
      b1.folder_id AS src_folder_id,
      b2.id AS tgt_id,
      b2.title AS tgt_title,
      b2.folder_id AS tgt_folder_id,
      (1 - (b1.embedding <=> b2.embedding))::FLOAT AS sim
    FROM bookmarks b1
    INNER JOIN bookmarks b2
      ON b1.user_id = b2.user_id
      AND b1.id < b2.id  -- 避免重复对
      AND b1.folder_id IS DISTINCT FROM b2.folder_id  -- 只看跨文件夹
      AND b1.embedding IS NOT NULL
      AND b2.embedding IS NOT NULL
    WHERE b1.user_id = p_user_id
      -- 可选：限制到指定文件夹
      AND (p_folder_id IS NULL OR b1.folder_id = p_folder_id OR b2.folder_id = p_folder_id)
      -- 相似度阈值
      AND (1 - (b1.embedding <=> b2.embedding)) >= p_min_similarity
    ORDER BY (b1.embedding <=> b2.embedding)
    LIMIT p_limit
  )
  SELECT
    bp.src_id,
    bp.src_title,
    bp.src_folder_id,
    f1.name AS src_folder_name,
    bp.tgt_id,
    bp.tgt_title,
    bp.tgt_folder_id,
    f2.name AS tgt_folder_name,
    bp.sim
  FROM bookmark_pairs bp
  LEFT JOIN folders f1 ON f1.id = bp.src_folder_id AND f1.user_id = p_user_id
  LEFT JOIN folders f2 ON f2.id = bp.tgt_folder_id AND f2.user_id = p_user_id
  ORDER BY bp.sim DESC;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION public.find_cross_folder_connections IS
'查询不同文件夹之间语义相关的书签对，用于知识图谱和关联分析';

-- 授予权限
GRANT EXECUTE ON FUNCTION public.find_cross_folder_connections TO authenticated;


/**
 * get_folder_similarity_matrix - 获取文件夹相似度矩阵
 *
 * 计算用户所有文件夹之间的平均内容相似度
 * 用于文件夹合并建议和知识组织优化
 *
 * @param p_user_id - 用户 ID
 * @param p_min_bookmarks - 文件夹最少书签数（默认 3）
 *
 * @returns 文件夹对及其平均相似度
 */
CREATE OR REPLACE FUNCTION public.get_folder_similarity_matrix(
  p_user_id UUID,
  p_min_bookmarks INT DEFAULT 3
)
RETURNS TABLE (
  folder1_id BIGINT,
  folder1_name TEXT,
  folder1_count INT,
  folder2_id BIGINT,
  folder2_name TEXT,
  folder2_count INT,
  avg_similarity FLOAT,
  max_similarity FLOAT,
  connection_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  WITH folder_stats AS (
    SELECT
      b.folder_id,
      COUNT(*)::INT AS bookmark_count
    FROM bookmarks b
    WHERE b.user_id = p_user_id
      AND b.folder_id IS NOT NULL
      AND b.embedding IS NOT NULL
    GROUP BY b.folder_id
    HAVING COUNT(*) >= p_min_bookmarks
  ),
  folder_pairs AS (
    SELECT
      b1.folder_id AS f1_id,
      b2.folder_id AS f2_id,
      AVG(1 - (b1.embedding <=> b2.embedding))::FLOAT AS avg_sim,
      MAX(1 - (b1.embedding <=> b2.embedding))::FLOAT AS max_sim,
      COUNT(*)::INT AS pair_count
    FROM bookmarks b1
    INNER JOIN bookmarks b2
      ON b1.user_id = b2.user_id
      AND b1.folder_id < b2.folder_id  -- 避免重复和自比较
      AND b1.embedding IS NOT NULL
      AND b2.embedding IS NOT NULL
    INNER JOIN folder_stats fs1 ON fs1.folder_id = b1.folder_id
    INNER JOIN folder_stats fs2 ON fs2.folder_id = b2.folder_id
    WHERE b1.user_id = p_user_id
    GROUP BY b1.folder_id, b2.folder_id
  )
  SELECT
    fp.f1_id,
    f1.name AS f1_name,
    fs1.bookmark_count AS f1_count,
    fp.f2_id,
    f2.name AS f2_name,
    fs2.bookmark_count AS f2_count,
    fp.avg_sim,
    fp.max_sim,
    fp.pair_count
  FROM folder_pairs fp
  JOIN folders f1 ON f1.id = fp.f1_id AND f1.user_id = p_user_id
  JOIN folders f2 ON f2.id = fp.f2_id AND f2.user_id = p_user_id
  JOIN folder_stats fs1 ON fs1.folder_id = fp.f1_id
  JOIN folder_stats fs2 ON fs2.folder_id = fp.f2_id
  WHERE fp.avg_sim > 0.5  -- 只返回有意义的相似度
  ORDER BY fp.avg_sim DESC;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION public.get_folder_similarity_matrix IS
'计算文件夹之间的平均内容相似度矩阵，用于文件夹合并建议';

-- 授予权限
GRANT EXECUTE ON FUNCTION public.get_folder_similarity_matrix TO authenticated;

-- ===========================================
-- V4.2 Phase 2.2: 核心区/边缘区画像扩展
-- ===========================================
-- 为 folder_profiles 表添加核心区和边缘区向量字段
-- 用于更精确的分类匹配

-- 确保 pgvector 扩展已启用
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 设置 search_path 以包含 extensions schema（使 vector 类型可用）
SET search_path TO public, extensions;

-- ============================================================================
-- 1. 核心区向量
-- ============================================================================

-- 核心区向量：代表文件夹最典型内容的向量
ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS core_embedding vector(1024);

COMMENT ON COLUMN public.folder_profiles.core_embedding
IS '核心区向量：文件夹最典型书签的中心向量（高置信度区域）';

-- ============================================================================
-- 2. 边缘区向量
-- ============================================================================

-- 边缘区向量：代表文件夹边界内容的向量
ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS edge_embedding vector(1024);

COMMENT ON COLUMN public.folder_profiles.edge_embedding
IS '边缘区向量：文件夹边界书签的向量（较低置信度但仍属于该文件夹）';

-- ============================================================================
-- 3. 核心区半径
-- ============================================================================

-- 核心区半径：核心向量周围的紧密程度
ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS core_radius FLOAT DEFAULT 0.15;

COMMENT ON COLUMN public.folder_profiles.core_radius
IS '核心区半径：距离核心向量的最大余弦距离（越小越紧密，通常 0.1-0.3）';

-- ============================================================================
-- 4. 边缘区半径
-- ============================================================================

-- 边缘区半径：整个文件夹的覆盖范围
ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS edge_radius FLOAT DEFAULT 0.35;

COMMENT ON COLUMN public.folder_profiles.edge_radius
IS '边缘区半径：文件夹覆盖的最大余弦距离（越大覆盖越广，通常 0.25-0.5）';

-- ============================================================================
-- 5. 核心区样本 ID
-- ============================================================================

-- 核心区包含的书签 ID 列表
ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS core_sample_ids BIGINT[];

COMMENT ON COLUMN public.folder_profiles.core_sample_ids
IS '核心区书签 ID 列表（最具代表性的书签）';

-- ============================================================================
-- 6. 边缘区样本 ID
-- ============================================================================

-- 边缘区包含的书签 ID 列表
ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS edge_sample_ids BIGINT[];

COMMENT ON COLUMN public.folder_profiles.edge_sample_ids
IS '边缘区书签 ID 列表（位于边界的书签）';

-- ============================================================================
-- 7. 核心区书签数量
-- ============================================================================

ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS core_count INT DEFAULT 0;

COMMENT ON COLUMN public.folder_profiles.core_count
IS '核心区书签数量';

-- ============================================================================
-- 8. 边缘区书签数量
-- ============================================================================

ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS edge_count INT DEFAULT 0;

COMMENT ON COLUMN public.folder_profiles.edge_count
IS '边缘区书签数量';

-- ============================================================================
-- 9. 核心区紧密度分数
-- ============================================================================

ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS core_tightness FLOAT;

COMMENT ON COLUMN public.folder_profiles.core_tightness
IS '核心区紧密度（0-1），1 表示核心区非常紧密，0 表示分散';

-- ============================================================================
-- 10. 边界清晰度分数
-- ============================================================================

ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS boundary_clarity FLOAT;

COMMENT ON COLUMN public.folder_profiles.boundary_clarity
IS '边界清晰度（0-1），1 表示核心/边缘区分明显，0 表示模糊';

-- ============================================================================
-- 11. 区域计算时间
-- ============================================================================

ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS zone_computed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.folder_profiles.zone_computed_at
IS '核心区/边缘区最后计算时间';

-- ============================================================================
-- 12. 核心区向量索引
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_folder_profiles_core_embedding_hnsw
ON public.folder_profiles
USING hnsw (core_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE core_embedding IS NOT NULL;

-- ============================================================================
-- 13. 边缘区向量索引
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_folder_profiles_edge_embedding_hnsw
ON public.folder_profiles
USING hnsw (edge_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE edge_embedding IS NOT NULL;

-- ============================================================================
-- 14. 核心区紧密度索引（用于找出高质量文件夹）
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_folder_profiles_core_tightness
ON public.folder_profiles(user_id, core_tightness DESC NULLS LAST)
WHERE core_tightness IS NOT NULL;

-- ============================================================================
-- 15. 边界清晰度索引（用于找出需要优化的文件夹）
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_folder_profiles_boundary_clarity
ON public.folder_profiles(user_id, boundary_clarity ASC NULLS LAST)
WHERE boundary_clarity IS NOT NULL;

-- ============================================================================
-- 16. 基于核心向量的相似度搜索函数
-- ============================================================================

CREATE OR REPLACE FUNCTION search_folders_by_core_similarity(
  p_user_id UUID,
  p_query_embedding vector(1024),
  p_limit INT DEFAULT 5,
  p_min_similarity FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  folder_id BIGINT,
  folder_name TEXT,
  core_similarity FLOAT,
  edge_similarity FLOAT,
  zone_match TEXT,
  confidence_level TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fp.folder_id,
    f.name::TEXT as folder_name,
    ROUND((1 - (fp.core_embedding <=> p_query_embedding))::NUMERIC, 4)::FLOAT as core_similarity,
    ROUND((1 - (fp.edge_embedding <=> p_query_embedding))::NUMERIC, 4)::FLOAT as edge_similarity,
    CASE
      WHEN (1 - (fp.core_embedding <=> p_query_embedding)) >= 0.85 THEN 'core'
      WHEN (1 - (fp.edge_embedding <=> p_query_embedding)) >= 0.7 THEN 'edge'
      ELSE 'outside'
    END as zone_match,
    CASE
      WHEN (1 - (fp.core_embedding <=> p_query_embedding)) >= 0.85 THEN 'high'
      WHEN (1 - (fp.core_embedding <=> p_query_embedding)) >= 0.75 THEN 'medium'
      WHEN (1 - (fp.edge_embedding <=> p_query_embedding)) >= 0.7 THEN 'low'
      ELSE 'none'
    END as confidence_level
  FROM folder_profiles fp
  JOIN folders f ON f.id = fp.folder_id
  WHERE fp.user_id = p_user_id
    AND fp.core_embedding IS NOT NULL
    AND f.deleted_at IS NULL
    AND (1 - (fp.core_embedding <=> p_query_embedding)) >= p_min_similarity
  ORDER BY core_similarity DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION search_folders_by_core_similarity
IS 'V4.2: 基于核心向量搜索相似文件夹，返回核心/边缘匹配信息';

GRANT EXECUTE ON FUNCTION search_folders_by_core_similarity(UUID, vector, INT, FLOAT)
TO authenticated;

-- ============================================================================
-- 17. 检查书签所属区域的函数
-- ============================================================================

CREATE OR REPLACE FUNCTION check_bookmark_zone(
  p_folder_id BIGINT,
  p_bookmark_embedding vector(1024)
)
RETURNS TABLE (
  zone TEXT,
  core_distance FLOAT,
  edge_distance FLOAT,
  is_in_core BOOLEAN,
  is_in_edge BOOLEAN,
  confidence FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_core_embedding vector(1024);
  v_edge_embedding vector(1024);
  v_core_radius FLOAT;
  v_edge_radius FLOAT;
  v_core_dist FLOAT;
  v_edge_dist FLOAT;
BEGIN
  -- 获取文件夹的核心/边缘画像
  SELECT
    fp.core_embedding,
    fp.edge_embedding,
    COALESCE(fp.core_radius, 0.15),
    COALESCE(fp.edge_radius, 0.35)
  INTO v_core_embedding, v_edge_embedding, v_core_radius, v_edge_radius
  FROM folder_profiles fp
  WHERE fp.folder_id = p_folder_id;

  -- 如果没有画像，返回 NULL
  IF v_core_embedding IS NULL THEN
    RETURN QUERY SELECT
      'unknown'::TEXT,
      NULL::FLOAT,
      NULL::FLOAT,
      NULL::BOOLEAN,
      NULL::BOOLEAN,
      NULL::FLOAT;
    RETURN;
  END IF;

  -- 计算距离（余弦距离）
  v_core_dist := v_core_embedding <=> p_bookmark_embedding;
  v_edge_dist := COALESCE(v_edge_embedding <=> p_bookmark_embedding, v_core_dist);

  -- 返回区域判断
  RETURN QUERY SELECT
    CASE
      WHEN v_core_dist <= v_core_radius THEN 'core'
      WHEN v_edge_dist <= v_edge_radius THEN 'edge'
      ELSE 'outside'
    END::TEXT as zone,
    ROUND(v_core_dist::NUMERIC, 4)::FLOAT as core_distance,
    ROUND(v_edge_dist::NUMERIC, 4)::FLOAT as edge_distance,
    v_core_dist <= v_core_radius as is_in_core,
    v_edge_dist <= v_edge_radius as is_in_edge,
    CASE
      WHEN v_core_dist <= v_core_radius THEN
        ROUND((1 - v_core_dist / v_core_radius)::NUMERIC * 0.3 + 0.7, 2)::FLOAT
      WHEN v_edge_dist <= v_edge_radius THEN
        ROUND((1 - v_edge_dist / v_edge_radius)::NUMERIC * 0.3 + 0.4, 2)::FLOAT
      ELSE
        ROUND(GREATEST(0, 0.3 - (v_edge_dist - v_edge_radius) * 2)::NUMERIC, 2)::FLOAT
    END as confidence;
END;
$$;

COMMENT ON FUNCTION check_bookmark_zone
IS 'V4.2: 检查书签向量属于文件夹的核心区、边缘区还是区域外';

GRANT EXECUTE ON FUNCTION check_bookmark_zone(BIGINT, vector)
TO authenticated;

-- ============================================================================
-- 完成
-- ============================================================================

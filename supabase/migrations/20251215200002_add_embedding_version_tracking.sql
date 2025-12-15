-- ===========================================
-- V4.2.7: Embedding 版本追踪
-- ===========================================
-- 为 folder_profiles 和 bookmarks 表添加 embedding 模型版本追踪
-- 解决不同版本模型生成的向量维度/质量不一致问题

-- ============================================================================
-- 1. folder_profiles 表添加版本字段
-- ============================================================================

-- 核心向量模型版本
ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS core_embedding_version TEXT DEFAULT 'v3';

COMMENT ON COLUMN public.folder_profiles.core_embedding_version
IS 'core_embedding 生成时使用的模型版本 (v3=1024维)';

-- 边缘向量模型版本
ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS edge_embedding_version TEXT DEFAULT 'v3';

COMMENT ON COLUMN public.folder_profiles.edge_embedding_version
IS 'edge_embedding 生成时使用的模型版本 (v3=1024维)';

-- Profile 向量模型版本
ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS profile_embedding_version TEXT DEFAULT 'v3';

COMMENT ON COLUMN public.folder_profiles.profile_embedding_version
IS 'profile_embedding 生成时使用的模型版本 (v3=1024维)';

-- 名称向量模型版本
ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS name_embedding_version TEXT DEFAULT 'v3';

COMMENT ON COLUMN public.folder_profiles.name_embedding_version
IS 'name_embedding 生成时使用的模型版本 (v3=1024维)';

-- ============================================================================
-- 2. bookmarks 表添加版本字段
-- ============================================================================

ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS embedding_version TEXT DEFAULT 'v3';

COMMENT ON COLUMN public.bookmarks.embedding_version
IS 'embedding 向量生成时使用的模型版本 (v3=1024维)';

-- ============================================================================
-- 3. 创建版本常量视图（便于应用查询当前版本）
-- ============================================================================

CREATE OR REPLACE VIEW public.embedding_model_config AS
SELECT
  'v3' as current_version,
  1024 as vector_dimension,
  'text-embedding-3-large' as model_name,
  '2025-12-15' as effective_date;

COMMENT ON VIEW public.embedding_model_config
IS '当前使用的 embedding 模型配置';

GRANT SELECT ON public.embedding_model_config TO authenticated;

-- ============================================================================
-- 4. 更新 compute_folder_profile 函数以设置版本
-- ============================================================================

-- 首先检查函数是否存在，如果存在则更新
DO $$
BEGIN
  -- 检查函数是否存在
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'compute_folder_profile'
  ) THEN
    -- 函数存在，记录日志
    RAISE NOTICE 'compute_folder_profile exists, will update in next migration if needed';
  END IF;
END $$;

-- ============================================================================
-- 5. 创建版本检查函数
-- ============================================================================

CREATE OR REPLACE FUNCTION check_embedding_version_compatibility(
  p_version TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- 当前只支持 v3 版本
  RETURN p_version = 'v3' OR p_version IS NULL;
END;
$$;

COMMENT ON FUNCTION check_embedding_version_compatibility
IS '检查 embedding 版本是否与当前系统兼容';

GRANT EXECUTE ON FUNCTION check_embedding_version_compatibility(TEXT) TO authenticated;

-- ============================================================================
-- 6. 创建需要重新生成 embedding 的书签视图
-- ============================================================================

CREATE OR REPLACE VIEW public.bookmarks_needing_reembedding AS
SELECT
  b.id,
  b.user_id,
  b.title,
  b.embedding_version,
  b.created_at
FROM public.bookmarks b
WHERE b.deleted_at IS NULL
  AND b.embedding IS NOT NULL
  AND (
    b.embedding_version IS NULL
    OR b.embedding_version != (SELECT current_version FROM public.embedding_model_config)
  );

COMMENT ON VIEW public.bookmarks_needing_reembedding
IS '需要重新生成 embedding 的书签列表（版本不匹配）';

GRANT SELECT ON public.bookmarks_needing_reembedding TO authenticated;

-- ============================================================================
-- 7. 创建需要重新计算 profile 的文件夹视图
-- ============================================================================

CREATE OR REPLACE VIEW public.folder_profiles_needing_update AS
SELECT
  fp.folder_id,
  fp.user_id,
  f.name as folder_name,
  fp.profile_embedding_version,
  fp.core_embedding_version,
  fp.last_updated
FROM public.folder_profiles fp
JOIN public.folders f ON f.id = fp.folder_id
WHERE f.deleted_at IS NULL
  AND (
    fp.profile_embedding IS NOT NULL
    AND (
      fp.profile_embedding_version IS NULL
      OR fp.profile_embedding_version != (SELECT current_version FROM public.embedding_model_config)
    )
  );

COMMENT ON VIEW public.folder_profiles_needing_update
IS '需要重新计算 profile 的文件夹列表（版本不匹配）';

GRANT SELECT ON public.folder_profiles_needing_update TO authenticated;

-- ============================================================================
-- 8. 添加版本索引（用于快速查找需要更新的记录）
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bookmarks_embedding_version
ON public.bookmarks(embedding_version)
WHERE embedding IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_folder_profiles_embedding_version
ON public.folder_profiles(profile_embedding_version)
WHERE profile_embedding IS NOT NULL;

-- ============================================================================
-- 9. 更新现有记录的版本字段（假设现有都是 v3）
-- ============================================================================

-- 批量更新 bookmarks（只更新有 embedding 但没有版本的记录）
UPDATE public.bookmarks
SET embedding_version = 'v3'
WHERE embedding IS NOT NULL
  AND embedding_version IS NULL;

-- 批量更新 folder_profiles
UPDATE public.folder_profiles
SET
  profile_embedding_version = CASE WHEN profile_embedding IS NOT NULL THEN 'v3' ELSE NULL END,
  core_embedding_version = CASE WHEN core_embedding IS NOT NULL THEN 'v3' ELSE NULL END,
  edge_embedding_version = CASE WHEN edge_embedding IS NOT NULL THEN 'v3' ELSE NULL END,
  name_embedding_version = CASE WHEN name_embedding IS NOT NULL THEN 'v3' ELSE NULL END
WHERE profile_embedding_version IS NULL
   OR core_embedding_version IS NULL
   OR edge_embedding_version IS NULL;

-- ============================================================================
-- 完成
-- ============================================================================

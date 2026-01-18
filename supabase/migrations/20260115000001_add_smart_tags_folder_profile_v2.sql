-- ============================================================================
-- 文件夹 Profile 智能标签增强 (V1.1)
-- ============================================================================
-- 版本: 1.1.0
-- 日期: 2026-01-15
-- 说明:
--   解决新文件夹冷启动问题，提升分类准确度
--
-- 改进：
--   1. 智能拆词：处理中英文混合、特殊符号分隔
--      例如："lims+实验室" → ["lims", "实验室", "实验室信息管理系统", ...]
--   2. 同义词扩展：为专业术语添加同义词
--      例如："前端" → ["前端", "frontend", "前端开发", "web前端", ...]
--   3. 增强标签匹配：top_tags 更丰富，提高向量搜索之外的辅助匹配
--
-- 兼容性：
--   - 保留 update_folder_name_embedding (v1) 用于回退
--   - 新增 update_folder_name_embedding_v2 接受智能标签参数
-- ============================================================================

-- ============================================================================
-- 1. 创建增强版函数 update_folder_name_embedding_v2
-- ============================================================================

CREATE OR REPLACE FUNCTION update_folder_name_embedding_v2(
  p_folder_id BIGINT,
  p_name_embedding vector(1024),
  p_smart_tags TEXT[]  -- 新增：智能标签数组
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_folder_name VARCHAR(100);
  v_bookmark_count INT;
  v_existing_profile_embedding vector(1024);
BEGIN
  -- 获取文件夹信息
  SELECT user_id, name INTO v_user_id, v_folder_name
  FROM public.folders
  WHERE id = p_folder_id AND deleted_at IS NULL;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Folder not found: %', p_folder_id;
  END IF;

  -- 获取现有书签数量
  SELECT COUNT(*)
  INTO v_bookmark_count
  FROM public.bookmarks
  WHERE folder_id = p_folder_id
    AND deleted_at IS NULL
    AND embedding IS NOT NULL;

  -- 获取现有 profile_embedding（如果存在）
  SELECT profile_embedding INTO v_existing_profile_embedding
  FROM public.folder_profiles
  WHERE folder_id = p_folder_id;

  -- 插入或更新 profile（使用智能标签）
  INSERT INTO public.folder_profiles (
    user_id,
    folder_id,
    name_embedding,
    profile_embedding,
    bookmark_count,
    top_tags,          -- 使用智能标签
    sample_titles,
    computed_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_folder_id,
    p_name_embedding,
    COALESCE(v_existing_profile_embedding, p_name_embedding),
    COALESCE(v_bookmark_count, 0),
    p_smart_tags,      -- 使用传入的智能标签
    '{}',
    NOW(),
    NOW()
  )
  ON CONFLICT (folder_id) DO UPDATE SET
    name_embedding = EXCLUDED.name_embedding,
    profile_embedding = CASE
      WHEN folder_profiles.bookmark_count = 0 OR folder_profiles.profile_embedding IS NULL
        THEN EXCLUDED.name_embedding
      ELSE folder_profiles.profile_embedding
    END,
    top_tags = EXCLUDED.top_tags,  -- 更新为智能标签
    updated_at = NOW();
END;
$$;

COMMENT ON FUNCTION update_folder_name_embedding_v2 IS 'V1.1: 更新文件夹名称向量并使用智能标签增强（拆词+同义词扩展）';

-- 授权
GRANT EXECUTE ON FUNCTION update_folder_name_embedding_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION update_folder_name_embedding_v2 TO service_role;

-- ============================================================================
-- 2. 验证函数
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Smart tags folder profile enhancement (v1.1) installed successfully';
  RAISE NOTICE 'Functions available:';
  RAISE NOTICE '  - update_folder_name_embedding (v1, fallback)';
  RAISE NOTICE '  - update_folder_name_embedding_v2 (v1.1, with smart tags)';
END $$;

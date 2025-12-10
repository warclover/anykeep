-- ===========================================
-- 修复 update_folder_name_embedding 函数
-- ===========================================
-- 版本: 4.2.1
-- 日期: 2025-12-10
-- 说明:
--   修复 vector 类型转换错误：cannot cast type vector to double precision[]
--   简化逻辑：只更新 name_embedding，不做加权平均（由 compute_folder_profile 处理）

CREATE OR REPLACE FUNCTION update_folder_name_embedding(
  p_folder_id BIGINT,
  p_name_embedding vector(1024)
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

  -- 插入或更新 profile
  -- 注意：只更新 name_embedding
  -- 如果文件夹没有书签，profile_embedding 设为 name_embedding
  -- 如果有书签，保持现有的 profile_embedding（由 compute_folder_profile 维护）
  INSERT INTO public.folder_profiles (
    user_id,
    folder_id,
    name_embedding,
    profile_embedding,
    bookmark_count,
    top_tags,
    sample_titles,
    computed_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_folder_id,
    p_name_embedding,
    COALESCE(v_existing_profile_embedding, p_name_embedding),  -- 优先使用已有的，没有则用 name
    COALESCE(v_bookmark_count, 0),
    ARRAY[v_folder_name],
    '{}',
    NOW(),
    NOW()
  )
  ON CONFLICT (folder_id) DO UPDATE SET
    name_embedding = EXCLUDED.name_embedding,
    -- 如果没有书签，也更新 profile_embedding 为 name_embedding
    profile_embedding = CASE
      WHEN folder_profiles.bookmark_count = 0 OR folder_profiles.profile_embedding IS NULL
        THEN EXCLUDED.name_embedding
      ELSE folder_profiles.profile_embedding
    END,
    -- 确保 top_tags 包含文件夹名称
    top_tags = CASE
      WHEN folder_profiles.bookmark_count = 0 THEN ARRAY[v_folder_name]
      WHEN NOT (v_folder_name = ANY(folder_profiles.top_tags))
        THEN ARRAY_PREPEND(v_folder_name, folder_profiles.top_tags[1:9])
      ELSE folder_profiles.top_tags
    END,
    updated_at = NOW();
END;
$$;

COMMENT ON FUNCTION update_folder_name_embedding IS '更新文件夹名称的向量嵌入（修复版 v4.2.1）';

-- 验证函数已更新
DO $$
BEGIN
  RAISE NOTICE 'update_folder_name_embedding function updated successfully';
END $$;

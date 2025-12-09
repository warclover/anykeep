-- ===========================================
-- 文件夹名称 Embedding 支持
-- ===========================================
-- 版本: 3.0.0
-- 日期: 2025-12-08
-- 说明:
--   1. 添加 name_embedding 字段到 folder_profiles 表
--   2. 修改 compute_folder_profile 函数支持加权平均
--   3. 新增 update_folder_name_embedding 函数用于创建/重命名时调用

-- -------------------------------------------
-- 1. 添加 name_embedding 字段
-- -------------------------------------------

ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS name_embedding vector(1024);

COMMENT ON COLUMN public.folder_profiles.name_embedding IS '文件夹名称的向量嵌入，用于冷启动分类匹配';

-- -------------------------------------------
-- 2. 修改 compute_folder_profile 函数
-- -------------------------------------------
-- 变更说明：
-- - 空文件夹时不再删除 profile，而是保留基于名称的 profile
-- - 有书签时，profile_embedding = 加权平均（名称 30% + 书签内容 70%）
-- - 如果没有 name_embedding，则只使用书签内容 embedding

CREATE OR REPLACE FUNCTION compute_folder_profile(p_folder_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_folder_name VARCHAR(100);
  v_bookmark_count INT;
  v_content_embedding vector(1024);
  v_name_embedding vector(1024);
  v_final_embedding vector(1024);
  v_top_tags TEXT[];
  v_sample_titles TEXT[];
  v_internal_sim FLOAT;
  v_last_bookmark_at TIMESTAMPTZ;

  -- 加权比例：名称 30%，书签内容 70%
  v_name_weight FLOAT := 0.3;
  v_content_weight FLOAT := 0.7;
BEGIN
  -- 获取文件夹所属用户和名称
  SELECT user_id, name INTO v_user_id, v_folder_name
  FROM public.folders
  WHERE id = p_folder_id AND deleted_at IS NULL;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Folder not found: %', p_folder_id;
  END IF;

  -- 获取现有的 name_embedding（如果有）
  SELECT name_embedding INTO v_name_embedding
  FROM public.folder_profiles
  WHERE folder_id = p_folder_id;

  -- 计算书签数量
  SELECT COUNT(*) INTO v_bookmark_count
  FROM public.bookmarks
  WHERE folder_id = p_folder_id
    AND deleted_at IS NULL;

  -- 如果没有书签，保留基于名称的 profile（如果存在）
  IF v_bookmark_count = 0 THEN
    -- 如果有 name_embedding，使用它作为 profile_embedding
    IF v_name_embedding IS NOT NULL THEN
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
        v_name_embedding,
        v_name_embedding,  -- 空文件夹时，profile = name embedding
        0,
        '{}',
        '{}',
        NOW(),
        NOW()
      )
      ON CONFLICT (folder_id) DO UPDATE SET
        profile_embedding = v_name_embedding,
        bookmark_count = 0,
        top_tags = '{}',
        sample_titles = '{}',
        last_bookmark_at = NULL,
        internal_similarity = NULL,
        computed_at = NOW(),
        updated_at = NOW();
    END IF;
    -- 如果既没有书签也没有 name_embedding，不做任何操作
    RETURN;
  END IF;

  -- 计算书签内容的平均向量
  SELECT AVG(embedding)::vector(1024) INTO v_content_embedding
  FROM public.bookmarks
  WHERE folder_id = p_folder_id
    AND deleted_at IS NULL
    AND embedding IS NOT NULL;

  -- 计算最终的 profile_embedding（加权平均）
  IF v_content_embedding IS NOT NULL AND v_name_embedding IS NOT NULL THEN
    -- 有名称 embedding 和内容 embedding：加权平均
    SELECT (
      (v_name_weight * v_name_embedding::float8[])::vector(1024) +
      (v_content_weight * v_content_embedding::float8[])::vector(1024)
    )::vector(1024) INTO v_final_embedding;
  ELSIF v_content_embedding IS NOT NULL THEN
    -- 只有内容 embedding
    v_final_embedding := v_content_embedding;
  ELSIF v_name_embedding IS NOT NULL THEN
    -- 只有名称 embedding
    v_final_embedding := v_name_embedding;
  ELSE
    -- 都没有
    v_final_embedding := NULL;
  END IF;

  -- 获取高频标签（前 10）
  SELECT ARRAY_AGG(tag ORDER BY cnt DESC)
  INTO v_top_tags
  FROM (
    SELECT UNNEST(ai_tags) AS tag, COUNT(*) AS cnt
    FROM public.bookmarks
    WHERE folder_id = p_folder_id
      AND deleted_at IS NULL
      AND ai_tags IS NOT NULL
    GROUP BY tag
    ORDER BY cnt DESC
    LIMIT 10
  ) t;

  -- 将文件夹名称添加到 top_tags 的第一位
  IF v_folder_name IS NOT NULL THEN
    v_top_tags := ARRAY_PREPEND(v_folder_name, COALESCE(v_top_tags, '{}'));
  END IF;

  -- 获取示例标题（最近 5 个）
  SELECT ARRAY_AGG(title ORDER BY created_at DESC)
  INTO v_sample_titles
  FROM (
    SELECT title, created_at
    FROM public.bookmarks
    WHERE folder_id = p_folder_id
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 5
  ) t;

  -- 获取最后书签时间
  SELECT MAX(created_at) INTO v_last_bookmark_at
  FROM public.bookmarks
  WHERE folder_id = p_folder_id
    AND deleted_at IS NULL;

  -- 计算内部相似度（如果有足够的书签）
  IF v_bookmark_count >= 2 AND v_content_embedding IS NOT NULL THEN
    SELECT AVG(1 - (embedding <=> v_content_embedding))::FLOAT INTO v_internal_sim
    FROM public.bookmarks
    WHERE folder_id = p_folder_id
      AND deleted_at IS NULL
      AND embedding IS NOT NULL;
  ELSE
    v_internal_sim := NULL;
  END IF;

  -- 插入或更新画像
  INSERT INTO public.folder_profiles (
    user_id,
    folder_id,
    name_embedding,
    profile_embedding,
    bookmark_count,
    last_bookmark_at,
    top_tags,
    sample_titles,
    internal_similarity,
    computed_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_folder_id,
    v_name_embedding,  -- 保留现有的 name_embedding
    v_final_embedding,
    v_bookmark_count,
    v_last_bookmark_at,
    COALESCE(v_top_tags, '{}'),
    COALESCE(v_sample_titles, '{}'),
    v_internal_sim,
    NOW(),
    NOW()
  )
  ON CONFLICT (folder_id) DO UPDATE SET
    profile_embedding = EXCLUDED.profile_embedding,
    bookmark_count = EXCLUDED.bookmark_count,
    last_bookmark_at = EXCLUDED.last_bookmark_at,
    top_tags = EXCLUDED.top_tags,
    sample_titles = EXCLUDED.sample_titles,
    internal_similarity = EXCLUDED.internal_similarity,
    computed_at = NOW(),
    updated_at = NOW();
END;
$$;

COMMENT ON FUNCTION compute_folder_profile IS '计算或更新指定文件夹的画像（支持名称 embedding 加权平均）';

-- -------------------------------------------
-- 3. 新增 update_folder_name_embedding 函数
-- -------------------------------------------
-- 用于在创建文件夹或重命名时，由 TypeScript 调用
-- TypeScript 负责生成 embedding，此函数只负责存储和计算

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
  v_content_embedding vector(1024);
  v_final_embedding vector(1024);

  -- 加权比例：名称 30%，书签内容 70%
  v_name_weight FLOAT := 0.3;
  v_content_weight FLOAT := 0.7;
BEGIN
  -- 获取文件夹信息
  SELECT user_id, name INTO v_user_id, v_folder_name
  FROM public.folders
  WHERE id = p_folder_id AND deleted_at IS NULL;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Folder not found: %', p_folder_id;
  END IF;

  -- 获取书签数量和内容 embedding
  SELECT COUNT(*), AVG(embedding)::vector(1024)
  INTO v_bookmark_count, v_content_embedding
  FROM public.bookmarks
  WHERE folder_id = p_folder_id
    AND deleted_at IS NULL
    AND embedding IS NOT NULL;

  -- 计算最终的 profile_embedding
  IF v_content_embedding IS NOT NULL AND p_name_embedding IS NOT NULL THEN
    -- 加权平均
    SELECT (
      (v_name_weight * p_name_embedding::float8[])::vector(1024) +
      (v_content_weight * v_content_embedding::float8[])::vector(1024)
    )::vector(1024) INTO v_final_embedding;
  ELSIF p_name_embedding IS NOT NULL THEN
    -- 只有名称 embedding（新建空文件夹）
    v_final_embedding := p_name_embedding;
  ELSIF v_content_embedding IS NOT NULL THEN
    -- 只有内容 embedding（不应该发生，但作为兜底）
    v_final_embedding := v_content_embedding;
  ELSE
    v_final_embedding := NULL;
  END IF;

  -- 插入或更新 profile
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
    v_final_embedding,
    COALESCE(v_bookmark_count, 0),
    ARRAY[v_folder_name],  -- 初始 top_tags 只包含文件夹名称
    '{}',
    NOW(),
    NOW()
  )
  ON CONFLICT (folder_id) DO UPDATE SET
    name_embedding = p_name_embedding,
    profile_embedding = v_final_embedding,
    top_tags = CASE
      WHEN EXCLUDED.bookmark_count = 0 THEN ARRAY[v_folder_name]
      ELSE ARRAY_PREPEND(v_folder_name, COALESCE(
        (SELECT ARRAY_AGG(t) FROM UNNEST(folder_profiles.top_tags) t WHERE t != v_folder_name LIMIT 9),
        '{}'
      ))
    END,
    updated_at = NOW();
END;
$$;

COMMENT ON FUNCTION update_folder_name_embedding IS '更新文件夹名称的向量嵌入（创建/重命名时调用）';

GRANT EXECUTE ON FUNCTION update_folder_name_embedding(BIGINT, vector) TO authenticated;

-- -------------------------------------------
-- 完成
-- -------------------------------------------

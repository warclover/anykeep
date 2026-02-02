-- =====================================================
-- 修复: compute_folder_profile 中 tags 列不存在错误
-- 问题: column "tags" does not exist
-- 原因: bookmarks 表使用 ai_tags 和 user_tags 两个独立列
-- 解决方案: 合并 ai_tags 和 user_tags 作为标签来源
-- 日期: 2026-01-23
-- 版本: V5.0.3
-- =====================================================

-- 确保 pgvector 扩展已启用
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 删除所有可能存在的旧函数签名
DROP FUNCTION IF EXISTS compute_folder_profile(INTEGER);
DROP FUNCTION IF EXISTS compute_folder_profile(BIGINT);
DROP FUNCTION IF EXISTS compute_folder_profile(INT);

-- 重新创建 compute_folder_profile 函数
-- 修复: 使用 ai_tags || user_tags 替代不存在的 tags 列
CREATE OR REPLACE FUNCTION compute_folder_profile(p_folder_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_folder_name VARCHAR(100);
  v_bookmark_count INTEGER;
  v_content_embedding extensions.vector(1024);
  v_name_embedding extensions.vector(1024);
  v_final_embedding extensions.vector(1024);
  v_top_tags TEXT[];
  v_sample_titles TEXT[];
  v_internal_similarity FLOAT;
  v_last_bookmark_at TIMESTAMPTZ;
BEGIN
  -- 1. 获取文件夹所属用户和名称
  SELECT user_id, name INTO v_user_id, v_folder_name
  FROM public.folders
  WHERE id = p_folder_id;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Folder % not found', p_folder_id;
    RETURN;
  END IF;

  -- 2. 获取该文件夹下有 embedding 的书签数量
  SELECT COUNT(*)::INTEGER INTO v_bookmark_count
  FROM public.bookmarks
  WHERE folder_id = p_folder_id
    AND deleted_at IS NULL
    AND embedding IS NOT NULL;

  -- 3. 获取现有的 name_embedding（如果有）
  SELECT name_embedding INTO v_name_embedding
  FROM public.folder_profiles
  WHERE folder_id = p_folder_id;

  -- 4. 如果没有书签，检查是否有 name_embedding
  IF v_bookmark_count = 0 THEN
    IF v_name_embedding IS NOT NULL THEN
      -- 空文件夹但有名称嵌入，保留基于名称的 profile
      INSERT INTO public.folder_profiles (
        user_id,
        folder_id,
        profile_embedding,
        name_embedding,
        bookmark_count,
        top_tags,
        sample_titles,
        internal_similarity,
        computed_at,
        updated_at
      ) VALUES (
        v_user_id,
        p_folder_id,
        v_name_embedding,  -- 使用名称嵌入作为 profile
        v_name_embedding,
        0,
        ARRAY[]::TEXT[],
        ARRAY[]::TEXT[],
        0,
        NOW(),
        NOW()
      )
      ON CONFLICT (folder_id) DO UPDATE SET
        profile_embedding = v_name_embedding,
        bookmark_count = 0,
        top_tags = ARRAY[]::TEXT[],
        sample_titles = ARRAY[]::TEXT[],
        internal_similarity = 0,
        computed_at = NOW(),
        updated_at = NOW();

      RAISE NOTICE 'Folder % has no bookmarks, using name embedding', p_folder_id;
      RETURN;
    ELSE
      -- 既没有书签也没有名称嵌入，删除 profile
      DELETE FROM public.folder_profiles WHERE folder_id = p_folder_id;
      RAISE NOTICE 'Folder % has no bookmarks and no name embedding, profile deleted', p_folder_id;
      RETURN;
    END IF;
  END IF;

  -- 5. 计算内容嵌入的平均值
  -- 使用 avg() 函数（pgvector 0.7.0+ 支持原生向量平均）
  BEGIN
    SELECT avg(embedding) INTO v_content_embedding
    FROM public.bookmarks
    WHERE folder_id = p_folder_id
      AND deleted_at IS NULL
      AND embedding IS NOT NULL;
  EXCEPTION WHEN undefined_function OR feature_not_supported THEN
    -- pgvector 版本不支持 avg()，使用手动计算
    WITH embedding_sum AS (
      SELECT
        array_agg(e.val ORDER BY e.idx) as sum_vals,
        COUNT(*) as cnt
      FROM public.bookmarks b,
           LATERAL unnest(b.embedding::float8[]) WITH ORDINALITY AS e(val, idx)
      WHERE b.folder_id = p_folder_id
        AND b.deleted_at IS NULL
        AND b.embedding IS NOT NULL
      GROUP BY e.idx
    )
    SELECT
      (SELECT array_agg(avg_val)::vector(1024)
       FROM (
         SELECT SUM(val) / COUNT(*)::float8 as avg_val
         FROM embedding_sum,
              LATERAL unnest(sum_vals) AS val
         GROUP BY 1
       ) t
      ) INTO v_content_embedding;
  END;

  -- 6. 计算最终的 profile_embedding
  IF v_name_embedding IS NOT NULL AND v_content_embedding IS NOT NULL THEN
    -- 加权平均：名称 30% + 内容 70%
    v_final_embedding := (v_name_embedding * 0.3::real) + (v_content_embedding * 0.7::real);
  ELSIF v_content_embedding IS NOT NULL THEN
    v_final_embedding := v_content_embedding;
  ELSIF v_name_embedding IS NOT NULL THEN
    v_final_embedding := v_name_embedding;
  ELSE
    -- 没有可用的嵌入
    RAISE NOTICE 'Folder % has no valid embeddings', p_folder_id;
    RETURN;
  END IF;

  -- 7. 获取 Top 10 标签
  -- 修复 V5.0.3: 合并 ai_tags 和 user_tags（原代码错误引用不存在的 tags 列）
  SELECT ARRAY(
    SELECT tag
    FROM (
      SELECT UNNEST(
        COALESCE(ai_tags, ARRAY[]::TEXT[]) || COALESCE(user_tags, ARRAY[]::TEXT[])
      ) as tag
      FROM public.bookmarks
      WHERE folder_id = p_folder_id
        AND deleted_at IS NULL
        AND (ai_tags IS NOT NULL OR user_tags IS NOT NULL)
    ) t
    GROUP BY tag
    ORDER BY COUNT(*) DESC
    LIMIT 10
  ) INTO v_top_tags;

  -- 8. 获取最近 5 个书签标题
  SELECT ARRAY(
    SELECT title
    FROM public.bookmarks
    WHERE folder_id = p_folder_id
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 5
  ) INTO v_sample_titles;

  -- 9. 计算内部相似度（简化版：取最近 10 个书签的平均余弦相似度）
  SELECT COALESCE(AVG(similarity), 0) INTO v_internal_similarity
  FROM (
    SELECT 1 - (b1.embedding <=> b2.embedding) as similarity
    FROM (
      SELECT id, embedding
      FROM public.bookmarks
      WHERE folder_id = p_folder_id
        AND deleted_at IS NULL
        AND embedding IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 10
    ) b1
    CROSS JOIN (
      SELECT id, embedding
      FROM public.bookmarks
      WHERE folder_id = p_folder_id
        AND deleted_at IS NULL
        AND embedding IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 10
    ) b2
    WHERE b1.id < b2.id
  ) pairs;

  -- 10. 获取最后一个书签的时间
  SELECT MAX(created_at) INTO v_last_bookmark_at
  FROM public.bookmarks
  WHERE folder_id = p_folder_id
    AND deleted_at IS NULL;

  -- 11. 插入或更新 profile
  INSERT INTO public.folder_profiles (
    user_id,
    folder_id,
    profile_embedding,
    name_embedding,
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
    v_final_embedding,
    v_name_embedding,
    v_bookmark_count,
    v_last_bookmark_at,
    v_top_tags,
    v_sample_titles,
    v_internal_similarity,
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

  RAISE NOTICE 'Folder % profile computed: % bookmarks', p_folder_id, v_bookmark_count;
END;
$$;

COMMENT ON FUNCTION compute_folder_profile(BIGINT) IS 'V5.0.3: 计算文件夹画像（修复 tags 列不存在错误，合并 ai_tags + user_tags）';

-- 授权
GRANT EXECUTE ON FUNCTION compute_folder_profile(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_folder_profile(BIGINT) TO service_role;

-- 注意: 不再创建 INTEGER 版本，避免 PostgREST PGRST203 函数重载歧义
-- TypeScript 的 number 类型会自动匹配 BIGINT

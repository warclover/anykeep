-- =====================================================
-- 修复: compute_folder_profile 向量乘法类型错误
-- 问题: operator does not exist: vector * real
-- 原因: pgvector 不支持 vector * scalar 操作
-- 解决方案: 使用 SQL 函数实现向量标量乘法
-- 日期: 2026-01-24
-- 版本: V5.0.5
-- =====================================================

-- 1. 创建向量转数组辅助函数
-- pgvector 不支持直接 ::float8[] 转换，需要通过文本解析
CREATE OR REPLACE FUNCTION vector_to_array(v vector)
RETURNS float8[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT string_to_array(
    ltrim(rtrim(v::text, ']'), '['),
    ','
  )::float8[]
$$;

COMMENT ON FUNCTION vector_to_array(vector) IS 'V5.0.5: 将 pgvector 转换为 float8 数组';

-- 2. 创建向量标量乘法辅助函数
CREATE OR REPLACE FUNCTION vector_scale(v vector, s float8)
RETURNS vector
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT array_agg(elem * s ORDER BY idx)::vector
  FROM unnest(vector_to_array(v)) WITH ORDINALITY AS t(elem, idx)
$$;

COMMENT ON FUNCTION vector_scale(vector, float8) IS 'V5.0.5: 向量标量乘法 - 将向量的每个元素乘以标量';

-- 3. 创建向量加法辅助函数（用于加权平均）
CREATE OR REPLACE FUNCTION vector_add(v1 vector, v2 vector)
RETURNS vector
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT array_agg(a + b ORDER BY idx)::vector
  FROM (
    SELECT
      ROW_NUMBER() OVER () AS idx,
      a, b
    FROM unnest(vector_to_array(v1), vector_to_array(v2)) AS t(a, b)
  ) sub
$$;

COMMENT ON FUNCTION vector_add(vector, vector) IS 'V5.0.5: 向量加法 - 逐元素相加';

-- 3. 删除旧函数
DROP FUNCTION IF EXISTS compute_folder_profile(INTEGER);
DROP FUNCTION IF EXISTS compute_folder_profile(BIGINT);
DROP FUNCTION IF EXISTS compute_folder_profile(INT);

-- 4. 重新创建 compute_folder_profile 函数
CREATE OR REPLACE FUNCTION compute_folder_profile(p_folder_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_folder_name VARCHAR(100);
  v_bookmark_count INTEGER;
  v_content_embedding vector(1024);
  v_name_embedding vector(1024);
  v_final_embedding vector(1024);
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
        v_name_embedding,
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
  -- 修复 V5.0.5: 使用 vector_scale 和 vector_add 替代不支持的 vector * scalar
  IF v_name_embedding IS NOT NULL AND v_content_embedding IS NOT NULL THEN
    -- 加权平均：名称 30% + 内容 70%
    v_final_embedding := vector_add(
      vector_scale(v_name_embedding, 0.3),
      vector_scale(v_content_embedding, 0.7)
    );
  ELSIF v_content_embedding IS NOT NULL THEN
    v_final_embedding := v_content_embedding;
  ELSIF v_name_embedding IS NOT NULL THEN
    v_final_embedding := v_name_embedding;
  ELSE
    RAISE NOTICE 'Folder % has no valid embeddings', p_folder_id;
    RETURN;
  END IF;

  -- 7. 获取 Top 10 标签
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

  -- 9. 计算内部相似度
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

COMMENT ON FUNCTION compute_folder_profile(BIGINT) IS 'V5.0.5: 计算文件夹画像（修复 pgvector 向量乘法兼容性问题）';

-- 授权
GRANT EXECUTE ON FUNCTION compute_folder_profile(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_folder_profile(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION vector_scale(vector, float8) TO authenticated;
GRANT EXECUTE ON FUNCTION vector_scale(vector, float8) TO service_role;
GRANT EXECUTE ON FUNCTION vector_add(vector, vector) TO authenticated;
GRANT EXECUTE ON FUNCTION vector_add(vector, vector) TO service_role;

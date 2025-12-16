-- =====================================================
-- 修复: 向量 AVG() 计算问题
-- 问题: PostgreSQL AVG() 函数不支持 pgvector 的 vector 类型
-- 解决方案: 使用 SUM + COUNT 手动计算平均值
-- 日期: 2025-12-15
-- 版本: V4.2.4
-- =====================================================

-- 先删除可能存在的旧函数（处理多签名情况）
DROP FUNCTION IF EXISTS compute_folder_profile(INTEGER);
DROP FUNCTION IF EXISTS compute_folder_profile(BIGINT);

-- 重新创建 compute_folder_profile 函数，修复向量平均计算
CREATE OR REPLACE FUNCTION compute_folder_profile(p_folder_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_bookmark_count INTEGER;
  v_avg_embedding vector(1024);
  v_top_tags TEXT[];
  v_sample_titles TEXT[];
  v_last_bookmark_at TIMESTAMPTZ;
  v_internal_sim FLOAT;
  v_vector_sum vector(1024);
  v_vector_count INTEGER;
BEGIN
  -- 获取文件夹所属用户
  SELECT user_id INTO v_user_id
  FROM public.folders
  WHERE id = p_folder_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Folder % not found', p_folder_id;
  END IF;

  -- 计算书签数量
  SELECT COUNT(*) INTO v_bookmark_count
  FROM public.bookmarks
  WHERE folder_id = p_folder_id
    AND deleted_at IS NULL;

  -- 如果没有书签，删除画像（如果存在）
  IF v_bookmark_count = 0 THEN
    DELETE FROM public.folder_profiles WHERE folder_id = p_folder_id;
    RETURN;
  END IF;

  -- V4.2.4: 修复向量平均计算
  -- PostgreSQL AVG() 不支持 vector 类型，需要手动计算
  SELECT
    COUNT(*),
    SUM(embedding)
  INTO v_vector_count, v_vector_sum
  FROM public.bookmarks
  WHERE folder_id = p_folder_id
    AND deleted_at IS NULL
    AND embedding IS NOT NULL;

  -- 计算平均向量（SUM / COUNT）
  IF v_vector_count > 0 AND v_vector_sum IS NOT NULL THEN
    -- pgvector 支持标量除法：vector / scalar
    v_avg_embedding := (v_vector_sum / v_vector_count)::vector(1024);
  ELSE
    v_avg_embedding := NULL;
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

  -- V4.2.4: 修复内部相似度计算
  -- 确保结果在 [0, 1] 范围内
  IF v_bookmark_count >= 2 AND v_avg_embedding IS NOT NULL THEN
    SELECT AVG(1 - (embedding <=> v_avg_embedding))::FLOAT INTO v_internal_sim
    FROM public.bookmarks
    WHERE folder_id = p_folder_id
      AND deleted_at IS NULL
      AND embedding IS NOT NULL;
    -- 确保范围有效
    v_internal_sim := GREATEST(0, LEAST(1, COALESCE(v_internal_sim, 0)));
  ELSE
    v_internal_sim := NULL;
  END IF;

  -- 插入或更新画像
  INSERT INTO public.folder_profiles (
    user_id,
    folder_id,
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
    v_avg_embedding,
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

COMMENT ON FUNCTION compute_folder_profile(INTEGER) IS 'V4.2.4: 计算或更新指定文件夹的画像（修复向量平均计算）';

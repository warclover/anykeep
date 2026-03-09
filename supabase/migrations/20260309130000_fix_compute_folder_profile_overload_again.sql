-- =====================================================
-- 修复: compute_folder_profile 函数重载歧义（再次）
-- 问题: 20260202020005 迁移重新引入了 INTEGER 版本的别名函数
--       导致 PostgREST PGRST203 无法选择候选函数
-- 解决方案: 用动态 SQL 按 OID 删除所有同名函数，然后重建唯一 BIGINT 版本
-- 日期: 2026-03-09
-- =====================================================

-- 第一步：通过 OID 动态删除所有同名函数（无论参数类型）
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'compute_folder_profile'
  LOOP
    RAISE NOTICE 'Dropping compute_folder_profile(%)', r.args;
    EXECUTE format('DROP FUNCTION IF EXISTS public.compute_folder_profile(%s)', r.args);
  END LOOP;
END $$;

-- 第二步：重建唯一的 BIGINT 版本
CREATE FUNCTION compute_folder_profile(p_folder_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_folder_name VARCHAR(100);
  v_bookmark_count INT;
  v_avg_embedding vector(1024);
  v_top_tags TEXT[];
  v_related_tags TEXT[];
  v_name_embedding vector(1024);
BEGIN
  -- 1. 获取文件夹信息
  SELECT f.user_id, f.name
  INTO v_user_id, v_folder_name
  FROM folders f
  WHERE f.id = p_folder_id AND f.is_deleted = false;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- 2. 统计文件夹内书签数
  SELECT COUNT(*)
  INTO v_bookmark_count
  FROM bookmarks b
  WHERE b.folder_id = p_folder_id
    AND b.is_deleted = false
    AND b.user_id = v_user_id;

  -- 3. 计算平均嵌入向量
  SELECT avg(b.embedding)
  INTO v_avg_embedding
  FROM bookmarks b
  WHERE b.folder_id = p_folder_id
    AND b.is_deleted = false
    AND b.user_id = v_user_id
    AND b.embedding IS NOT NULL;

  -- 4. 计算 Top 标签（出现频率最高的 10 个）
  SELECT ARRAY_AGG(tag ORDER BY cnt DESC)
  INTO v_top_tags
  FROM (
    SELECT unnest(b.ai_tags) AS tag, COUNT(*) AS cnt
    FROM bookmarks b
    WHERE b.folder_id = p_folder_id
      AND b.is_deleted = false
      AND b.user_id = v_user_id
      AND b.ai_tags IS NOT NULL
    GROUP BY tag
    ORDER BY cnt DESC
    LIMIT 10
  ) t;

  -- 5. 计算相关标签（出现 2 次以上但不在 top 中的标签）
  SELECT ARRAY_AGG(tag ORDER BY cnt DESC)
  INTO v_related_tags
  FROM (
    SELECT unnest(b.ai_tags) AS tag, COUNT(*) AS cnt
    FROM bookmarks b
    WHERE b.folder_id = p_folder_id
      AND b.is_deleted = false
      AND b.user_id = v_user_id
      AND b.ai_tags IS NOT NULL
    GROUP BY tag
    HAVING COUNT(*) >= 2
    ORDER BY cnt DESC
    LIMIT 20
  ) t
  WHERE NOT (tag = ANY(COALESCE(v_top_tags, ARRAY[]::TEXT[])));

  -- 6. 保留已有的 name_embedding（如果存在）
  SELECT ftp.name_embedding
  INTO v_name_embedding
  FROM folder_tag_profiles ftp
  WHERE ftp.folder_id = p_folder_id AND ftp.user_id = v_user_id;

  -- 7. Upsert folder_tag_profiles
  INSERT INTO folder_tag_profiles (
    user_id,
    folder_id,
    core_tags,
    related_tags,
    avg_embedding,
    name_embedding,
    bookmark_count,
    updated_at
  ) VALUES (
    v_user_id,
    p_folder_id,
    COALESCE(v_top_tags, ARRAY[]::TEXT[]),
    COALESCE(v_related_tags, ARRAY[]::TEXT[]),
    v_avg_embedding,
    v_name_embedding,
    v_bookmark_count,
    NOW()
  )
  ON CONFLICT (user_id, folder_id)
  DO UPDATE SET
    core_tags = COALESCE(v_top_tags, ARRAY[]::TEXT[]),
    related_tags = COALESCE(v_related_tags, ARRAY[]::TEXT[]),
    avg_embedding = v_avg_embedding,
    bookmark_count = v_bookmark_count,
    updated_at = NOW();

END;
$$;

COMMENT ON FUNCTION compute_folder_profile(BIGINT) IS 'V5.0.3: 计算文件夹 Profile（唯一版本，无重载）';

-- 授权
GRANT EXECUTE ON FUNCTION compute_folder_profile(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_folder_profile(BIGINT) TO service_role;

-- 验证只剩 1 个版本
DO $$
DECLARE
  func_count INT;
BEGIN
  SELECT COUNT(*) INTO func_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname = 'compute_folder_profile';

  IF func_count != 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 compute_folder_profile function, found %', func_count;
  END IF;

  RAISE NOTICE 'compute_folder_profile: only BIGINT version remains';
END $$;

-- ===========================================
-- 修复知识关联及文件夹画像 RPC 函数中的 is_deleted 引用
-- ===========================================
-- 版本: 1.0.0
-- 日期: 2026-03-18
-- 说明: bookmarks/folders 表使用 deleted_at（软删除时间戳），
--       但多个 RPC 函数错误引用了不存在的 is_deleted 布尔列，
--       导致知识关联发现、查询及文件夹画像计算全部静默失败。
--       本迁移统一修正为 deleted_at IS NULL。

-- -------------------------------------------
-- 1. find_bookmarks_by_tags: 标签关联发现
--    修复: b.is_deleted = false → b.deleted_at IS NULL
-- -------------------------------------------

CREATE OR REPLACE FUNCTION public.find_bookmarks_by_tags(
    p_user_id UUID,
    p_tags TEXT[],
    p_exclude_id BIGINT DEFAULT NULL,
    p_min_shared INT DEFAULT 2,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    bookmark_id BIGINT,
    title TEXT,
    shared_count INT,
    shared_tags TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH tag_matches AS (
        SELECT
            b.id,
            b.title,
            ARRAY_AGG(t.tag) as matched_tags
        FROM public.bookmarks b
        CROSS JOIN LATERAL unnest(b.ai_tags) AS t(tag)
        WHERE b.user_id = p_user_id
          AND b.deleted_at IS NULL
          AND (p_exclude_id IS NULL OR b.id != p_exclude_id)
          AND t.tag = ANY(p_tags)
        GROUP BY b.id, b.title
    )
    SELECT
        tm.id as bookmark_id,
        tm.title,
        array_length(tm.matched_tags, 1) as shared_count,
        tm.matched_tags as shared_tags
    FROM tag_matches tm
    WHERE array_length(tm.matched_tags, 1) >= p_min_shared
    ORDER BY shared_count DESC, tm.id DESC
    LIMIT p_limit;
END;
$$;

-- -------------------------------------------
-- 2. find_similar_bookmarks_for_linking: 向量相似度关联发现
--    修复: b.is_deleted = false → b.deleted_at IS NULL
-- -------------------------------------------

CREATE OR REPLACE FUNCTION public.find_similar_bookmarks_for_linking(
    p_user_id UUID,
    p_bookmark_id BIGINT,
    p_min_similarity FLOAT DEFAULT 0.7,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    bookmark_id BIGINT,
    title TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH source AS (
        SELECT b.embedding as src_embedding
        FROM public.bookmarks b
        WHERE b.id = p_bookmark_id
          AND b.user_id = p_user_id
          AND b.embedding IS NOT NULL
        LIMIT 1
    )
    SELECT
        b.id as bookmark_id,
        b.title,
        (1 - (b.embedding <=> source.src_embedding)) as similarity
    FROM public.bookmarks b
    CROSS JOIN source
    WHERE b.user_id = p_user_id
      AND b.id != p_bookmark_id
      AND b.embedding IS NOT NULL
      AND b.deleted_at IS NULL
      AND (1 - (b.embedding <=> source.src_embedding)) >= p_min_similarity
    ORDER BY b.embedding <=> source.src_embedding
    LIMIT p_limit;
END;
$$;

-- -------------------------------------------
-- 3. get_related_bookmarks_with_details: 知识关联查询
--    修复: b.is_deleted = false → b.deleted_at IS NULL
-- -------------------------------------------

CREATE OR REPLACE FUNCTION public.get_related_bookmarks_with_details(
    p_bookmark_id BIGINT,
    p_user_id UUID,
    p_limit INT DEFAULT 10,
    p_min_strength FLOAT DEFAULT 0.3,
    p_link_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    bookmark_id BIGINT,
    title TEXT,
    url TEXT,
    favicon TEXT,
    platform TEXT,
    link_type TEXT,
    strength FLOAT,
    shared_items TEXT[],
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH links AS (
        SELECT
            CASE
                WHEN kl.source_bookmark_id = p_bookmark_id THEN kl.target_bookmark_id
                ELSE kl.source_bookmark_id
            END as related_id,
            kl.link_type,
            kl.strength,
            kl.evidence,
            kl.created_at
        FROM public.knowledge_links kl
        WHERE (kl.source_bookmark_id = p_bookmark_id OR kl.target_bookmark_id = p_bookmark_id)
          AND kl.user_id = p_user_id
          AND kl.strength >= p_min_strength
          AND (p_link_types IS NULL OR kl.link_type = ANY(p_link_types))
        ORDER BY kl.strength DESC
        LIMIT p_limit
    )
    SELECT
        b.id as bookmark_id,
        b.title,
        b.url,
        b.favicon,
        b.platform,
        l.link_type,
        l.strength,
        COALESCE(
            CASE l.link_type
                WHEN 'entity' THEN (
                    SELECT ARRAY_AGG(e::TEXT)
                    FROM jsonb_array_elements_text(l.evidence->'details'->'sharedEntities') e
                )
                WHEN 'tag' THEN (
                    SELECT ARRAY_AGG(t::TEXT)
                    FROM jsonb_array_elements_text(l.evidence->'details'->'sharedTags') t
                )
                ELSE ARRAY[]::TEXT[]
            END,
            ARRAY[]::TEXT[]
        ) as shared_items,
        l.created_at
    FROM links l
    JOIN public.bookmarks b ON b.id = l.related_id
    WHERE b.deleted_at IS NULL
    ORDER BY l.strength DESC;
END;
$$;

-- -------------------------------------------
-- 4. compute_folder_profile: 文件夹画像计算
--    修复: f.is_deleted = false → f.deleted_at IS NULL
--          b.is_deleted = false → b.deleted_at IS NULL (5处)
--    注意: 必须先 DROP 再 CREATE，因为原始迁移使用 CREATE (非 OR REPLACE)
-- -------------------------------------------

DROP FUNCTION IF EXISTS public.compute_folder_profile(BIGINT);

CREATE FUNCTION public.compute_folder_profile(p_folder_id BIGINT)
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
  WHERE f.id = p_folder_id AND f.deleted_at IS NULL;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- 2. 统计文件夹内书签数
  SELECT COUNT(*)
  INTO v_bookmark_count
  FROM bookmarks b
  WHERE b.folder_id = p_folder_id
    AND b.deleted_at IS NULL
    AND b.user_id = v_user_id;

  -- 3. 计算平均嵌入向量
  SELECT avg(b.embedding)
  INTO v_avg_embedding
  FROM bookmarks b
  WHERE b.folder_id = p_folder_id
    AND b.deleted_at IS NULL
    AND b.user_id = v_user_id
    AND b.embedding IS NOT NULL;

  -- 4. 计算 Top 标签（出现频率最高的 10 个）
  SELECT ARRAY_AGG(tag ORDER BY cnt DESC)
  INTO v_top_tags
  FROM (
    SELECT unnest(b.ai_tags) AS tag, COUNT(*) AS cnt
    FROM bookmarks b
    WHERE b.folder_id = p_folder_id
      AND b.deleted_at IS NULL
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
      AND b.deleted_at IS NULL
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

COMMENT ON FUNCTION public.compute_folder_profile(BIGINT) IS 'V5.0.4: 计算文件夹 Profile（修复 is_deleted → deleted_at）';
GRANT EXECUTE ON FUNCTION public.compute_folder_profile(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_folder_profile(BIGINT) TO service_role;

-- -------------------------------------------
-- 5. recompute_folder_top_authors: 文件夹作者统计
--    修复: is_deleted = false → deleted_at IS NULL (2处)
-- -------------------------------------------

CREATE OR REPLACE FUNCTION public.recompute_folder_top_authors(p_folder_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_authored_count INT;
  v_top_authors JSONB;
BEGIN
  -- 获取文件夹所属用户
  SELECT user_id INTO v_user_id
  FROM folders
  WHERE id = p_folder_id AND deleted_at IS NULL;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- 获取有作者信息的书签总数
  SELECT COUNT(*)
  INTO v_authored_count
  FROM bookmarks
  WHERE folder_id = p_folder_id
    AND deleted_at IS NULL
    AND user_id = v_user_id
    AND (
      (source_name IS NOT NULL AND TRIM(source_name) <> '')
      OR (author IS NOT NULL AND TRIM(author) <> '')
    );

  IF v_authored_count = 0 THEN
    UPDATE folder_profiles
    SET top_authors = '[]'::JSONB, updated_at = NOW()
    WHERE folder_id = p_folder_id;
    RETURN;
  END IF;

  -- 聚合 source_name（优先）/ author，取前 10
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', sub.author_key,
        'count', sub.cnt,
        'ratio', ROUND(sub.cnt::NUMERIC / v_authored_count, 4)
      )
      ORDER BY sub.cnt DESC
    ),
    '[]'::JSONB
  )
  INTO v_top_authors
  FROM (
    SELECT
      COALESCE(NULLIF(TRIM(source_name), ''), NULLIF(TRIM(author), '')) AS author_key,
      COUNT(*) AS cnt
    FROM bookmarks
    WHERE folder_id = p_folder_id
      AND deleted_at IS NULL
      AND user_id = v_user_id
      AND (
        (source_name IS NOT NULL AND TRIM(source_name) <> '')
        OR (author IS NOT NULL AND TRIM(author) <> '')
      )
    GROUP BY COALESCE(NULLIF(TRIM(source_name), ''), NULLIF(TRIM(author), ''))
    ORDER BY cnt DESC
    LIMIT 10
  ) sub;

  -- 更新 folder_profiles
  UPDATE folder_profiles
  SET top_authors = v_top_authors, updated_at = NOW()
  WHERE folder_id = p_folder_id;

  IF NOT FOUND THEN
    RAISE WARNING 'recompute_folder_top_authors: folder_profile not found for folder_id=%', p_folder_id;
  END IF;

END;
$$;

COMMENT ON FUNCTION public.recompute_folder_top_authors(BIGINT) IS '重算文件夹 top_authors（修复 is_deleted → deleted_at）';

-- -------------------------------------------
-- 完成
-- -------------------------------------------

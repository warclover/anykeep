-- ===========================================
-- 清理无意义文件夹并添加名称黑名单过滤
-- ===========================================
-- 版本: 2.0.2
-- 日期: 2025-12-08
-- 说明:
--   1. 软删除名称无意义的文件夹（如"内容分类与标签管理"）
--   2. 将受影响的书签移动到待整理（folder_id = NULL）
--   3. 清理对应的文件夹画像
--   4. 更新 SQL 函数添加名称黑名单过滤

-- -------------------------------------------
-- 1. 定义黑名单文件夹名称
-- -------------------------------------------
DO $$
DECLARE
  invalid_folder_names TEXT[] := ARRAY[
    '内容分类与标签管理',
    '内容分类',
    '标签管理',
    '未分类',
    '新建文件夹',
    'New Folder',
    'Untitled',
    'Unnamed'
  ];
  affected_folder_ids BIGINT[];
  folder_record RECORD;
BEGIN
  -- 查找所有无意义名称的文件夹
  SELECT ARRAY_AGG(id) INTO affected_folder_ids
  FROM public.folders
  WHERE name = ANY(invalid_folder_names)
    AND is_system = FALSE
    AND deleted_at IS NULL;

  IF affected_folder_ids IS NOT NULL AND array_length(affected_folder_ids, 1) > 0 THEN
    -- 记录日志
    RAISE NOTICE 'Found % invalid folders to clean up: %', array_length(affected_folder_ids, 1), affected_folder_ids;

    -- 将受影响书签的 folder_id 设为 NULL（移动到待整理）
    UPDATE public.bookmarks
    SET folder_id = NULL,
        updated_at = NOW()
    WHERE folder_id = ANY(affected_folder_ids)
      AND deleted_at IS NULL;

    RAISE NOTICE 'Moved bookmarks from invalid folders to inbox';

    -- 删除对应的文件夹画像
    DELETE FROM public.folder_profiles
    WHERE folder_id = ANY(affected_folder_ids);

    RAISE NOTICE 'Cleaned up folder profiles';

    -- 软删除这些文件夹
    UPDATE public.folders
    SET deleted_at = NOW(),
        name = name || '_deleted_' || id::TEXT  -- 防止名称冲突
    WHERE id = ANY(affected_folder_ids);

    RAISE NOTICE 'Soft deleted invalid folders';
  ELSE
    RAISE NOTICE 'No invalid folders found';
  END IF;
END $$;

-- -------------------------------------------
-- 2. 更新相似文件夹搜索函数 - 添加名称黑名单
-- -------------------------------------------
CREATE OR REPLACE FUNCTION search_similar_folders(
  query_embedding vector(1024),
  p_user_id UUID,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  folder_id BIGINT,
  folder_name VARCHAR(100),
  bookmark_count INT,
  top_tags TEXT[],
  sample_titles TEXT[],
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  -- 名称黑名单：这些名称不应该作为分类目标
  blacklisted_names TEXT[] := ARRAY[
    '内容分类与标签管理',
    '内容分类',
    '标签管理',
    '未分类',
    '新建文件夹',
    'New Folder',
    'Untitled',
    'Unnamed'
  ];
BEGIN
  RETURN QUERY
  SELECT
    fp.folder_id,
    f.name AS folder_name,
    fp.bookmark_count,
    fp.top_tags,
    fp.sample_titles,
    (1 - (fp.profile_embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.folder_profiles fp
  INNER JOIN public.folders f ON f.id = fp.folder_id
  WHERE fp.user_id = p_user_id
    AND f.deleted_at IS NULL
    AND f.is_system = FALSE  -- 排除系统文件夹
    AND f.name NOT IN (SELECT unnest(blacklisted_names))  -- 排除黑名单名称
    AND fp.profile_embedding IS NOT NULL
    AND (1 - (fp.profile_embedding <=> query_embedding)) > match_threshold
  ORDER BY fp.profile_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_similar_folders IS '搜索与给定向量最相似的文件夹（排除系统文件夹和黑名单名称），用于智能分类 v2.0.2';

-- -------------------------------------------
-- 3. 更新历史相似书签函数 - 添加名称黑名单
-- -------------------------------------------
CREATE OR REPLACE FUNCTION find_similar_bookmarks_with_folders(
  query_embedding vector(1024),
  p_user_id UUID,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  bookmark_id BIGINT,
  bookmark_title VARCHAR(500),
  folder_id BIGINT,
  folder_name VARCHAR(100),
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  -- 名称黑名单
  blacklisted_names TEXT[] := ARRAY[
    '内容分类与标签管理',
    '内容分类',
    '标签管理',
    '未分类',
    '新建文件夹',
    'New Folder',
    'Untitled',
    'Unnamed'
  ];
BEGIN
  RETURN QUERY
  SELECT
    b.id AS bookmark_id,
    b.title AS bookmark_title,
    b.folder_id,
    f.name AS folder_name,
    (1 - (b.embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.bookmarks b
  INNER JOIN public.folders f ON f.id = b.folder_id
    AND f.deleted_at IS NULL
    AND f.is_system = FALSE  -- 排除系统文件夹
    AND f.name NOT IN (SELECT unnest(blacklisted_names))  -- 排除黑名单名称
  WHERE b.user_id = p_user_id
    AND b.deleted_at IS NULL
    AND b.embedding IS NOT NULL
    AND b.folder_id IS NOT NULL
  ORDER BY b.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION find_similar_bookmarks_with_folders IS '查找与给定向量最相似的已分类书签（排除系统文件夹和黑名单名称）v2.0.2';

-- -------------------------------------------
-- 完成
-- -------------------------------------------
COMMENT ON SCHEMA public IS 'AnyKeep 应用数据库架构 v2.0.2 - 添加文件夹名称黑名单过滤';

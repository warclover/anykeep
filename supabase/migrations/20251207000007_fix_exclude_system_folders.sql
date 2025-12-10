-- ===========================================
-- 修复：排除系统文件夹作为分类目标
-- ===========================================
-- 版本: 2.0.1
-- 日期: 2025-12-07
-- 说明: 修复智能分类系统中系统文件夹（如"待整理"）被作为分类目标的问题
--       - 更新 find_similar_bookmarks_with_folders 函数
--       - 更新 search_similar_folders 函数
--       添加 is_system = FALSE 过滤条件

-- -------------------------------------------
-- 1. 修复历史相似书签查询函数
-- -------------------------------------------
-- 问题：原函数没有过滤系统文件夹，导致"待整理"中的书签被匹配
-- 修复：添加 f.is_system = FALSE 条件

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
    AND f.is_system = FALSE  -- 排除系统文件夹（待整理等）
  WHERE b.user_id = p_user_id
    AND b.deleted_at IS NULL
    AND b.embedding IS NOT NULL
    AND b.folder_id IS NOT NULL  -- 只考虑已分类的书签
  ORDER BY b.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION find_similar_bookmarks_with_folders IS '查找与给定向量最相似的已分类书签及其所属文件夹（排除系统文件夹），用于历史行为匹配';

-- -------------------------------------------
-- 2. 修复相似文件夹搜索函数
-- -------------------------------------------
-- 问题：原函数没有过滤系统文件夹
-- 修复：添加 f.is_system = FALSE 条件

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
    AND f.is_system = FALSE  -- 排除系统文件夹（待整理等）
    AND fp.profile_embedding IS NOT NULL
    AND (1 - (fp.profile_embedding <=> query_embedding)) > match_threshold
  ORDER BY fp.profile_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_similar_folders IS '搜索与给定向量最相似的文件夹（排除系统文件夹），用于智能分类';

-- -------------------------------------------
-- 完成
-- -------------------------------------------

COMMENT ON SCHEMA public IS 'AnyKeep 应用数据库架构 v2.0.1 - 修复系统文件夹排除问题';

-- 修复 find_related_bookmarks RPC 函数的类型不匹配问题
-- 问题：RETURNS TABLE 声明的类型与实际 SELECT 返回的列类型不匹配
-- 解决：在 SELECT 中显式转换类型以确保匹配
-- @version 1.0.1
-- @since 2025-12-11

-- 设置 search_path
SET search_path TO public, extensions;

/**
 * find_related_bookmarks - 查询与指定书签相似的其他书签 (修复版)
 *
 * 使用向量距离（余弦相似度）查找语义相关的书签
 * 支持跨文件夹查询，帮助用户发现知识连接
 */
CREATE OR REPLACE FUNCTION public.find_related_bookmarks(
  p_bookmark_id BIGINT,
  p_user_id UUID,
  p_limit INT DEFAULT 5,
  p_min_similarity FLOAT DEFAULT 0.5,
  p_exclude_same_folder BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id BIGINT,
  title TEXT,
  url TEXT,
  description TEXT,
  similarity FLOAT,
  folder_id BIGINT,
  folder_name TEXT,
  platform TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_source_embedding vector(1024);
  v_source_folder_id BIGINT;
BEGIN
  -- 获取源书签的 embedding 和文件夹
  SELECT b.embedding, b.folder_id
  INTO v_source_embedding, v_source_folder_id
  FROM bookmarks b
  WHERE b.id = p_bookmark_id
    AND b.user_id = p_user_id;

  -- 如果源书签不存在或没有 embedding，返回空结果
  IF v_source_embedding IS NULL THEN
    RETURN;
  END IF;

  -- 查询相关书签（显式类型转换确保匹配）
  RETURN QUERY
  SELECT
    b.id::BIGINT,
    b.title::TEXT,
    b.url::TEXT,
    b.description::TEXT,
    (1 - (b.embedding <=> v_source_embedding))::FLOAT AS similarity,
    b.folder_id::BIGINT,
    f.name::TEXT AS folder_name,
    b.platform::TEXT,
    b.created_at::TIMESTAMPTZ
  FROM bookmarks b
  LEFT JOIN folders f ON f.id = b.folder_id AND f.user_id = p_user_id
  WHERE b.user_id = p_user_id
    AND b.id != p_bookmark_id
    AND b.embedding IS NOT NULL
    -- 可选：排除同文件夹的书签
    AND (NOT p_exclude_same_folder OR b.folder_id IS DISTINCT FROM v_source_folder_id)
    -- 相似度阈值过滤
    AND (1 - (b.embedding <=> v_source_embedding)) >= p_min_similarity
  ORDER BY b.embedding <=> v_source_embedding
  LIMIT p_limit;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION public.find_related_bookmarks IS
'查询与指定书签语义相似的其他书签，用于相关内容推荐功能 (v1.0.1 修复类型匹配)';

-- 确保权限
GRANT EXECUTE ON FUNCTION public.find_related_bookmarks TO authenticated;

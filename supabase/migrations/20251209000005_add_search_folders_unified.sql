-- V4.1 统一向量搜索函数
-- 合并 profile_embedding + name_embedding 搜索，支持冷启动
-- 2025-12-09
-- V4.1.1: 修复 VARCHAR->TEXT 类型转换和 search_path 问题

-- 先删除旧版本函数（解决类型缓存问题）
DROP FUNCTION IF EXISTS search_folders_unified(UUID, vector, INT);

-- 创建统一搜索函数
CREATE OR REPLACE FUNCTION search_folders_unified(
  p_user_id UUID,
  p_embedding vector(1024),
  p_limit INT DEFAULT 5
)
RETURNS TABLE (
  folder_id BIGINT,
  folder_name TEXT,
  similarity FLOAT,
  match_type TEXT,
  bookmark_count INT,
  top_tags TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  WITH all_matches AS (
    -- 方案 1: 有内容的文件夹 - 使用 profile_embedding
    SELECT
      fp.folder_id,
      f.name::TEXT AS folder_name,  -- 显式转换 VARCHAR -> TEXT
      (1 - (fp.profile_embedding <=> p_embedding))::FLOAT AS similarity,
      'profile'::TEXT AS match_type,
      COALESCE(fp.bookmark_count, 0)::INT AS bookmark_count,
      COALESCE(fp.top_tags, ARRAY[]::TEXT[]) AS top_tags
    FROM folder_profiles fp
    INNER JOIN folders f ON f.id = fp.folder_id
    WHERE fp.user_id = p_user_id
      AND f.deleted_at IS NULL
      AND f.is_system = FALSE
      AND fp.profile_embedding IS NOT NULL

    UNION ALL

    -- 方案 2: 空文件夹 - 使用 name_embedding（冷启动支持）
    -- 降权 15%（乘以 0.85）因为仅基于名称匹配可靠性较低
    SELECT
      fp.folder_id,
      f.name::TEXT AS folder_name,  -- 显式转换 VARCHAR -> TEXT
      ((1 - (fp.name_embedding <=> p_embedding)) * 0.85)::FLOAT AS similarity,
      'name'::TEXT AS match_type,
      0::INT AS bookmark_count,
      ARRAY[f.name::TEXT]::TEXT[] AS top_tags  -- 显式转换 VARCHAR -> TEXT
    FROM folder_profiles fp
    INNER JOIN folders f ON f.id = fp.folder_id
    WHERE fp.user_id = p_user_id
      AND f.deleted_at IS NULL
      AND f.is_system = FALSE
      AND fp.profile_embedding IS NULL  -- 仅匹配空文件夹
      AND fp.name_embedding IS NOT NULL
  )
  SELECT
    am.folder_id,
    am.folder_name,
    am.similarity,
    am.match_type,
    am.bookmark_count,
    am.top_tags
  FROM all_matches am
  WHERE am.similarity > 0.4  -- 最低阈值 40%
  ORDER BY am.similarity DESC
  LIMIT p_limit;
END;
$$;

-- 添加注释
COMMENT ON FUNCTION search_folders_unified IS 'V4.1 统一向量搜索：合并 profile + name embedding，支持冷启动';

-- 授权
GRANT EXECUTE ON FUNCTION search_folders_unified TO authenticated;
GRANT EXECUTE ON FUNCTION search_folders_unified TO service_role;

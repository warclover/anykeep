-- ============================================
-- C4: 增强切片搜索函数的用户 ID 验证
-- 防止未授权访问其他用户的数据
-- ============================================

-- 增强版切片向量搜索函数
-- 安全改进：
-- 1. 强制使用 auth.uid() 而非可选参数
-- 2. 增加 NULL 检查，未认证用户返回空结果
CREATE OR REPLACE FUNCTION search_bookmark_chunks(
  query_embedding VECTOR(1024),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 20,
  p_user_id UUID DEFAULT NULL -- 保持签名兼容，但内部会覆盖
)
RETURNS TABLE (
  chunk_id UUID,
  bookmark_id BIGINT,
  chunk_content TEXT,
  chunk_type VARCHAR(20),
  chunk_index INT,
  parent_content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_user_id UUID;
BEGIN
  -- C4: 安全增强 - 强制使用认证用户 ID
  -- 优先使用 auth.uid()，如果为 NULL（服务角色调用），则使用传入的 p_user_id
  IF auth.uid() IS NOT NULL THEN
    effective_user_id := auth.uid();
  ELSIF auth.role() = 'service_role' AND p_user_id IS NOT NULL THEN
    -- 服务角色可以指定用户 ID
    effective_user_id := p_user_id;
  ELSE
    -- 未认证且非服务角色，返回空结果
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id AS chunk_id,
    c.bookmark_id,
    c.content AS chunk_content,
    c.chunk_type,
    c.chunk_index,
    COALESCE(p.content, c.content) AS parent_content,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM bookmark_chunks c
  LEFT JOIN bookmark_chunks p ON c.parent_chunk_id = p.id
  JOIN bookmarks b ON c.bookmark_id = b.id
  WHERE b.user_id = effective_user_id
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 更新函数注释
COMMENT ON FUNCTION search_bookmark_chunks IS 'Parent-Child 切片向量搜索（安全增强版），强制用户 ID 验证';

-- 增强版切片统计函数
CREATE OR REPLACE FUNCTION get_chunk_stats(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  total_chunks BIGINT,
  parent_chunks BIGINT,
  child_chunks BIGINT,
  bookmarks_with_chunks BIGINT,
  avg_chunks_per_bookmark FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_user_id UUID;
BEGIN
  -- C4: 安全增强 - 强制使用认证用户 ID
  IF auth.uid() IS NOT NULL THEN
    effective_user_id := auth.uid();
  ELSIF auth.role() = 'service_role' AND p_user_id IS NOT NULL THEN
    effective_user_id := p_user_id;
  ELSE
    -- 未认证且非服务角色，返回零统计
    RETURN QUERY SELECT 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::FLOAT;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COUNT(c.id)::BIGINT AS total_chunks,
    COUNT(c.id) FILTER (WHERE c.chunk_type = 'parent')::BIGINT AS parent_chunks,
    COUNT(c.id) FILTER (WHERE c.chunk_type = 'child')::BIGINT AS child_chunks,
    COUNT(DISTINCT c.bookmark_id)::BIGINT AS bookmarks_with_chunks,
    CASE
      WHEN COUNT(DISTINCT c.bookmark_id) > 0
      THEN COUNT(c.id)::FLOAT / COUNT(DISTINCT c.bookmark_id)::FLOAT
      ELSE 0
    END AS avg_chunks_per_bookmark
  FROM bookmark_chunks c
  JOIN bookmarks b ON c.bookmark_id = b.id
  WHERE b.user_id = effective_user_id;
END;
$$;

-- 更新函数注释
COMMENT ON FUNCTION get_chunk_stats IS '获取用户的切片统计信息（安全增强版）';

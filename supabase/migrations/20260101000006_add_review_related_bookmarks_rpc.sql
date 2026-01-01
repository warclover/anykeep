-- ============================================================================
-- Migration: 新增 Brain-Sync 专用的相关书签查询函数 (带相关原因)
-- ============================================================================

-- 设置 search_path 以包含 extensions schema（使 vector 类型可用）
SET search_path TO public, extensions;

/**
 * get_review_related_bookmarks - 获取复习时的相关书签推荐
 *
 * 专门用于 Brain-Sync 复习场景，返回相关书签及相关原因
 * 优先级：共同标签 > 同文件夹 > 内容相似
 *
 * @param p_bookmark_id - 当前复习卡片对应的书签 ID
 * @param p_user_id - 用户 ID
 * @param p_limit - 返回数量限制（默认 3）
 *
 * @returns 相关书签列表，包含相关原因
 */
CREATE OR REPLACE FUNCTION public.get_review_related_bookmarks(
  p_bookmark_id BIGINT,
  p_user_id UUID,
  p_limit INT DEFAULT 3
)
RETURNS TABLE (
  id BIGINT,
  title TEXT,
  relevance_reason TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_source_embedding vector(1024);
  v_source_folder_id BIGINT;
BEGIN
  -- 权限验证
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 获取源书签的 embedding 和文件夹
  SELECT b.embedding, b.folder_id
  INTO v_source_embedding, v_source_folder_id
  FROM bookmarks b
  WHERE b.id = p_bookmark_id
    AND b.user_id = p_user_id;

  -- 如果没有 embedding，返回同文件夹的书签
  IF v_source_embedding IS NULL THEN
    RETURN QUERY
    SELECT
      b.id,
      b.title,
      '同一文件夹'::TEXT AS relevance_reason,
      0.5::FLOAT AS similarity
    FROM bookmarks b
    WHERE b.user_id = p_user_id
      AND b.id != p_bookmark_id
      AND b.folder_id = v_source_folder_id
      AND b.folder_id IS NOT NULL
    ORDER BY b.created_at DESC
    LIMIT p_limit;
    RETURN;
  END IF;

  -- 使用向量相似度 + 标签匹配 + 文件夹信息
  RETURN QUERY
  WITH common_tags AS (
    -- 查找共同标签
    SELECT
      bt2.bookmark_id,
      string_agg(DISTINCT t.name, '、' ORDER BY t.name) AS tag_names
    FROM bookmark_tags bt1
    JOIN bookmark_tags bt2 ON bt1.tag_id = bt2.tag_id
    JOIN tags t ON t.id = bt1.tag_id
    WHERE bt1.bookmark_id = p_bookmark_id
      AND bt2.bookmark_id != p_bookmark_id
    GROUP BY bt2.bookmark_id
  ),
  ranked_bookmarks AS (
    SELECT
      b.id,
      b.title,
      -- 计算相关原因（优先级：共同标签 > 同文件夹 > 内容相似）
      CASE
        WHEN ct.tag_names IS NOT NULL THEN
          '共同标签：' || (
            SELECT string_agg(tag_name, '、')
            FROM (
              SELECT unnest(string_to_array(ct.tag_names, '、')) AS tag_name
              LIMIT 2
            ) sub
          )
        WHEN b.folder_id IS NOT NULL AND b.folder_id = v_source_folder_id THEN
          '同一文件夹'
        ELSE
          '内容相似'
      END AS relevance_reason,
      (1 - (b.embedding <=> v_source_embedding))::FLOAT AS similarity,
      -- 用于排序的优先级分数
      CASE
        WHEN ct.tag_names IS NOT NULL THEN 3
        WHEN b.folder_id IS NOT NULL AND b.folder_id = v_source_folder_id THEN 2
        ELSE 1
      END AS priority_score
    FROM bookmarks b
    LEFT JOIN common_tags ct ON ct.bookmark_id = b.id
    WHERE b.user_id = p_user_id
      AND b.id != p_bookmark_id
      AND b.embedding IS NOT NULL
      -- 相似度阈值（排除不太相关的）
      AND (1 - (b.embedding <=> v_source_embedding)) >= 0.3
  )
  SELECT
    rb.id,
    rb.title,
    rb.relevance_reason,
    rb.similarity
  FROM ranked_bookmarks rb
  -- 按优先级和相似度排序
  ORDER BY rb.priority_score DESC, rb.similarity DESC
  LIMIT p_limit;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION public.get_review_related_bookmarks IS
'获取 Brain-Sync 复习时的相关书签推荐，包含相关原因（共同标签/同文件夹/内容相似）';

-- 授予权限
GRANT EXECUTE ON FUNCTION public.get_review_related_bookmarks TO authenticated;

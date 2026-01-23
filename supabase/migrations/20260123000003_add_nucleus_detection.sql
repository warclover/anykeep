-- ===========================================
-- AnyKeep v5.5 晶体生长系统 - 晶核检测与配额函数
-- ===========================================
-- 版本: 5.5.0
-- 日期: 2026-01-23
-- 说明: 创建晶核检测邻居查找和统一配额统计 RPC 函数

-- -------------------------------------------
-- 1. 查找混沌池中的邻居（用于晶核检测）
-- -------------------------------------------

CREATE OR REPLACE FUNCTION find_chaos_pool_neighbors(
  p_user_id UUID,
  p_bookmark_id BIGINT,
  p_radius FLOAT DEFAULT 0.20,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  bookmark_id BIGINT,
  title TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH target AS (
    SELECT b.embedding
    FROM public.bookmarks b
    WHERE b.id = p_bookmark_id
      AND b.user_id = p_user_id
      AND b.embedding IS NOT NULL
  )
  SELECT
    cp.bookmark_id,
    b.title::TEXT,
    1 - (b.embedding <=> t.embedding) AS similarity
  FROM public.chaos_pool cp
  JOIN public.bookmarks b ON b.id = cp.bookmark_id
  CROSS JOIN target t
  WHERE cp.user_id = p_user_id
    AND cp.bookmark_id != p_bookmark_id
    AND cp.crystal_processed = FALSE  -- 只搜索未处理的
    AND b.embedding IS NOT NULL
    AND b.deleted_at IS NULL
    AND 1 - (b.embedding <=> t.embedding) > (1 - p_radius)
  ORDER BY similarity DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION find_chaos_pool_neighbors(UUID, BIGINT, FLOAT, INT) IS
  'V5.5 晶核检测：查找混沌池中与指定书签语义相近的邻居书签';

-- -------------------------------------------
-- 2. 统一配额统计函数
-- -------------------------------------------

CREATE OR REPLACE FUNCTION get_unified_quota_stats(p_user_id UUID)
RETURNS TABLE (
  ai_folder_count INT,
  total_folder_count INT,
  empty_folder_count INT,
  total_bookmark_count BIGINT,
  today_created_count INT
) AS $$
BEGIN
  RETURN QUERY
  WITH folder_stats AS (
    SELECT
      f.id,
      f.is_ai_generated,
      (
        SELECT COUNT(*)
        FROM public.bookmarks bm
        WHERE bm.folder_id = f.id
          AND bm.deleted_at IS NULL
      ) AS bookmark_count
    FROM public.folders f
    WHERE f.user_id = p_user_id
      AND f.deleted_at IS NULL
  )
  SELECT
    COUNT(*) FILTER (WHERE fs.is_ai_generated = TRUE)::INT AS ai_folder_count,
    COUNT(*)::INT AS total_folder_count,
    COUNT(*) FILTER (WHERE fs.bookmark_count = 0)::INT AS empty_folder_count,
    (
      SELECT COUNT(*)
      FROM public.bookmarks
      WHERE user_id = p_user_id
        AND deleted_at IS NULL
    ) AS total_bookmark_count,
    (
      SELECT COUNT(*)
      FROM public.folders
      WHERE user_id = p_user_id
        AND is_ai_generated = TRUE
        AND created_at >= CURRENT_DATE
        AND deleted_at IS NULL
    )::INT AS today_created_count
  FROM folder_stats fs;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_unified_quota_stats(UUID) IS
  'V5.5 统一配额统计：返回 AI 文件夹数、总文件夹数、空文件夹数、总书签数、今日创建数';

-- -------------------------------------------
-- 3. 获取混沌池书签 ID 列表（用于 SmartSorting 互斥）
-- -------------------------------------------

CREATE OR REPLACE FUNCTION get_chaos_pool_bookmark_ids(p_user_id UUID)
RETURNS BIGINT[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT bookmark_id
    FROM public.chaos_pool
    WHERE user_id = p_user_id
      AND crystal_processed = FALSE
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_chaos_pool_bookmark_ids(UUID) IS
  'V5.5 获取混沌池中未处理的书签 ID 列表，用于 SmartSorting 互斥处理';

-- -------------------------------------------
-- 4. 批量标记混沌池记录已处理
-- -------------------------------------------

CREATE OR REPLACE FUNCTION mark_chaos_pool_processed(
  p_user_id UUID,
  p_bookmark_ids BIGINT[],
  p_result_folder_id BIGINT
)
RETURNS INT AS $$
DECLARE
  updated_count INT;
BEGIN
  UPDATE public.chaos_pool
  SET
    crystal_processed = TRUE,
    processed_at = NOW(),
    result_folder_id = p_result_folder_id
  WHERE user_id = p_user_id
    AND bookmark_id = ANY(p_bookmark_ids);

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION mark_chaos_pool_processed(UUID, BIGINT[], BIGINT) IS
  'V5.5 批量标记混沌池记录为已处理，并记录结果文件夹';

-- -------------------------------------------
-- 5. 添加书签到混沌池
-- -------------------------------------------

CREATE OR REPLACE FUNCTION add_to_chaos_pool(
  p_user_id UUID,
  p_bookmark_id BIGINT
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO public.chaos_pool (user_id, bookmark_id)
  VALUES (p_user_id, p_bookmark_id)
  ON CONFLICT (user_id, bookmark_id) DO NOTHING;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION add_to_chaos_pool(UUID, BIGINT) IS
  'V5.5 将书签添加到混沌池，如果已存在则忽略';

-- -------------------------------------------
-- 完成
-- -------------------------------------------

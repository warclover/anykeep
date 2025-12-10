-- ===========================================
-- V4.2 Phase 2.1.2: bookmarks 表扩展 - 缓存池标记
-- ===========================================
-- 添加待聚类标记，用于 AI 智能分拣功能

-- 1. 添加待聚类标记
-- 当书签低置信度进入待整理时，标记为待聚类状态
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS pending_cluster BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.bookmarks.pending_cluster IS '是否在缓存池等待聚类分析（低置信度书签）';

-- 2. 添加进入缓存池时间
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS pending_since TIMESTAMPTZ;

COMMENT ON COLUMN public.bookmarks.pending_since IS '进入缓存池等待聚类的时间';

-- 3. 添加聚类 ID（同一聚类的书签共享同一 ID）
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS cluster_id UUID;

COMMENT ON COLUMN public.bookmarks.cluster_id IS '聚类 ID，同一聚类的书签共享此 ID';

-- 4. 添加聚类置信度
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS cluster_confidence FLOAT;

COMMENT ON COLUMN public.bookmarks.cluster_confidence IS '聚类置信度 (0-1)';

-- 5. 创建复合索引（用于查询待聚类书签）
CREATE INDEX IF NOT EXISTS idx_bookmarks_pending_cluster
ON public.bookmarks(user_id, pending_cluster, pending_since)
WHERE pending_cluster = TRUE AND deleted_at IS NULL;

-- 6. 创建聚类 ID 索引
CREATE INDEX IF NOT EXISTS idx_bookmarks_cluster_id
ON public.bookmarks(cluster_id)
WHERE cluster_id IS NOT NULL;

-- 7. 创建获取用户待聚类书签的函数
CREATE OR REPLACE FUNCTION get_pending_cluster_bookmarks(
  p_user_id UUID,
  p_min_age_hours INT DEFAULT 1,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  id BIGINT,
  title VARCHAR(500),
  url TEXT,
  ai_summary TEXT,
  ai_tags TEXT[],
  embedding extensions.vector(1024),
  pending_since TIMESTAMPTZ,
  cluster_id UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.title,
    b.url,
    b.ai_summary,
    b.ai_tags,
    b.embedding,
    b.pending_since,
    b.cluster_id
  FROM public.bookmarks b
  WHERE b.user_id = p_user_id
    AND b.pending_cluster = TRUE
    AND b.deleted_at IS NULL
    AND b.pending_since < NOW() - (p_min_age_hours || ' hours')::INTERVAL
  ORDER BY b.pending_since ASC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_pending_cluster_bookmarks IS '获取用户待聚类的书签（已等待指定时间）';
GRANT EXECUTE ON FUNCTION get_pending_cluster_bookmarks(UUID, INT, INT) TO authenticated;

-- 8. 创建标记书签为待聚类的函数
CREATE OR REPLACE FUNCTION mark_bookmark_pending_cluster(
  p_bookmark_id BIGINT,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.bookmarks
  SET pending_cluster = TRUE,
      pending_since = NOW()
  WHERE id = p_bookmark_id
    AND user_id = p_user_id
    AND deleted_at IS NULL
    AND pending_cluster = FALSE;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION mark_bookmark_pending_cluster IS '将书签标记为待聚类状态';
GRANT EXECUTE ON FUNCTION mark_bookmark_pending_cluster(BIGINT, UUID) TO authenticated;

-- 9. 创建清除书签待聚类标记的函数（分类成功后调用）
CREATE OR REPLACE FUNCTION clear_bookmark_pending_cluster(
  p_bookmark_id BIGINT,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.bookmarks
  SET pending_cluster = FALSE,
      pending_since = NULL,
      cluster_id = NULL,
      cluster_confidence = NULL
  WHERE id = p_bookmark_id
    AND user_id = p_user_id
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION clear_bookmark_pending_cluster IS '清除书签的待聚类标记（分类成功后）';
GRANT EXECUTE ON FUNCTION clear_bookmark_pending_cluster(BIGINT, UUID) TO authenticated;

-- 10. 创建批量分配聚类 ID 的函数
CREATE OR REPLACE FUNCTION assign_cluster_id(
  p_bookmark_ids BIGINT[],
  p_cluster_id UUID,
  p_confidence FLOAT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.bookmarks
  SET cluster_id = p_cluster_id,
      cluster_confidence = p_confidence
  WHERE id = ANY(p_bookmark_ids)
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION assign_cluster_id IS '为一组书签分配相同的聚类 ID';
GRANT EXECUTE ON FUNCTION assign_cluster_id(BIGINT[], UUID, FLOAT) TO authenticated;

-- 11. 创建获取聚类统计的函数
CREATE OR REPLACE FUNCTION get_user_cluster_stats(p_user_id UUID)
RETURNS TABLE (
  total_pending INT,
  clustered_count INT,
  unclustered_count INT,
  cluster_count INT,
  oldest_pending TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INT AS total_pending,
    COUNT(*) FILTER (WHERE cluster_id IS NOT NULL)::INT AS clustered_count,
    COUNT(*) FILTER (WHERE cluster_id IS NULL)::INT AS unclustered_count,
    COUNT(DISTINCT cluster_id)::INT AS cluster_count,
    MIN(pending_since) AS oldest_pending
  FROM public.bookmarks
  WHERE user_id = p_user_id
    AND pending_cluster = TRUE
    AND deleted_at IS NULL;
END;
$$;

COMMENT ON FUNCTION get_user_cluster_stats IS '获取用户的聚类统计信息';
GRANT EXECUTE ON FUNCTION get_user_cluster_stats(UUID) TO authenticated;

-- ===========================================
-- 完成
-- ===========================================

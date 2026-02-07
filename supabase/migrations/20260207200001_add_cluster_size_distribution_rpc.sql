-- ============================================================================
-- 聚类大小分布 RPC 函数
-- 返回用户书签聚类的大小分布统计
-- ============================================================================

CREATE OR REPLACE FUNCTION get_cluster_size_distribution()
RETURNS TABLE (
  size_range TEXT,
  cluster_count BIGINT,
  label TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  WITH cluster_sizes AS (
    -- 计算每个聚类的书签数量
    SELECT
      cluster_id,
      COUNT(*) as bookmark_count
    FROM bookmarks
    WHERE user_id = v_user_id
      AND cluster_id IS NOT NULL
      AND deleted_at IS NULL
    GROUP BY cluster_id
  ),
  size_categories AS (
    -- 将聚类按大小分类
    SELECT
      CASE
        WHEN bookmark_count <= 2 THEN '1-2'
        WHEN bookmark_count <= 5 THEN '3-5'
        WHEN bookmark_count <= 10 THEN '6-10'
        ELSE '10+'
      END as size_range,
      CASE
        WHEN bookmark_count <= 2 THEN '小型 (1-2)'
        WHEN bookmark_count <= 5 THEN '中型 (3-5)'
        WHEN bookmark_count <= 10 THEN '大型 (6-10)'
        ELSE '超大 (10+)'
      END as label,
      CASE
        WHEN bookmark_count <= 2 THEN 1
        WHEN bookmark_count <= 5 THEN 2
        WHEN bookmark_count <= 10 THEN 3
        ELSE 4
      END as sort_order
    FROM cluster_sizes
  )
  SELECT
    sc.size_range,
    COUNT(*)::BIGINT as cluster_count,
    sc.label
  FROM size_categories sc
  GROUP BY sc.size_range, sc.label, sc.sort_order
  ORDER BY sc.sort_order;
END;
$$;

-- 授权
GRANT EXECUTE ON FUNCTION get_cluster_size_distribution() TO authenticated;

COMMENT ON FUNCTION get_cluster_size_distribution() IS '获取用户书签聚类的大小分布统计';

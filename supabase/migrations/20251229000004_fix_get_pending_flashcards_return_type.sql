-- ============================================================================
-- 修复 get_pending_flashcards 返回类型
-- 版本: 1.0
-- 日期: 2025-12-29
-- 描述: 修复 bookmark_title 列类型不匹配 (TEXT vs VARCHAR(500))
-- 错误: PostgreSQL 42804 - structure of query does not match function result type
-- ============================================================================

-- 删除旧函数
DROP FUNCTION IF EXISTS get_pending_flashcards(UUID, INT, BIGINT[], BIGINT[]);

-- 重新创建函数，修复返回类型
CREATE OR REPLACE FUNCTION get_pending_flashcards(
  p_user_id UUID,
  p_limit INT DEFAULT 10,
  p_included_folders BIGINT[] DEFAULT NULL,
  p_excluded_folders BIGINT[] DEFAULT NULL
)
RETURNS TABLE (
  flashcard_id BIGINT,
  bookmark_id BIGINT,
  bookmark_title VARCHAR(500),  -- 修复: TEXT → VARCHAR(500) 匹配 bookmarks.title
  bookmark_url TEXT,
  question TEXT,
  answer TEXT,
  source_paragraph TEXT,
  status VARCHAR(20),
  ease_factor DECIMAL(4,2),
  interval_days INT,
  repetitions INT,
  next_review_at TIMESTAMPTZ,
  days_overdue INT,
  priority_score DECIMAL(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id AS flashcard_id,
    f.bookmark_id,
    b.title AS bookmark_title,
    b.url AS bookmark_url,
    f.question,
    f.answer,
    f.source_paragraph,
    f.status,
    f.ease_factor,
    f.interval_days,
    f.repetitions,
    f.next_review_at,
    COALESCE(EXTRACT(DAY FROM (now() - f.next_review_at))::INT, 0) AS days_overdue,
    -- 优先级计算: 逾期天数权重 + 难度权重 + 间隔权重
    (
      COALESCE(EXTRACT(DAY FROM (now() - f.next_review_at)), 0) * 0.4 +
      (3.0 - f.ease_factor) * 10 * 0.3 +
      (1.0 / NULLIF(f.interval_days, 0)) * 100 * 0.3
    )::DECIMAL(5,2) AS priority_score
  FROM flashcards f
  JOIN bookmarks b ON f.bookmark_id = b.id
  WHERE f.user_id = p_user_id
    AND f.status != 'mastered'
    AND (f.next_review_at IS NULL OR f.next_review_at <= now() + INTERVAL '3 days')
    -- 文件夹筛选
    AND (p_included_folders IS NULL OR array_length(p_included_folders, 1) IS NULL OR b.folder_id = ANY(p_included_folders))
    AND (p_excluded_folders IS NULL OR array_length(p_excluded_folders, 1) IS NULL OR b.folder_id != ALL(p_excluded_folders))
  ORDER BY priority_score DESC
  LIMIT p_limit;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION get_pending_flashcards IS
  '获取待复习的 Flashcards，按优先级排序（逾期 > 难度 > 间隔）';

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION get_pending_flashcards TO authenticated;

-- ============================================
-- 完成
-- ============================================

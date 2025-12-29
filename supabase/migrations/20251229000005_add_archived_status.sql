-- ============================================================================
-- 添加 archived 状态支持
-- 版本: 1.0
-- 日期: 2025-12-29
-- 描述: 支持「永久掌握」功能，允许用户归档不再需要复习的卡片
-- ============================================================================

-- ============================================
-- 1. 更新 flashcards 表的 status 约束
-- ============================================

-- 删除旧约束
ALTER TABLE flashcards DROP CONSTRAINT IF EXISTS flashcards_status_check;

-- 添加新约束（包含 archived 状态）
ALTER TABLE flashcards ADD CONSTRAINT flashcards_status_check
  CHECK (status IN ('pending', 'learning', 'mastered', 'archived'));

-- ============================================
-- 2. 添加归档相关索引
-- ============================================

-- 已归档卡片索引（用于卡片管理页面）
CREATE INDEX IF NOT EXISTS idx_flashcards_archived
  ON flashcards(user_id, updated_at DESC)
  WHERE status = 'archived';

-- ============================================
-- 3. 更新 get_pending_flashcards 函数排除归档卡片
-- ============================================

-- 删除旧函数
DROP FUNCTION IF EXISTS get_pending_flashcards(UUID, INT, BIGINT[], BIGINT[]);

-- 重新创建函数，排除 archived 状态
CREATE OR REPLACE FUNCTION get_pending_flashcards(
  p_user_id UUID,
  p_limit INT DEFAULT 10,
  p_included_folders BIGINT[] DEFAULT NULL,
  p_excluded_folders BIGINT[] DEFAULT NULL
)
RETURNS TABLE (
  flashcard_id BIGINT,
  bookmark_id BIGINT,
  bookmark_title VARCHAR(500),
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
    AND f.status NOT IN ('mastered', 'archived')  -- 排除已掌握和已归档
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
  '获取待复习的 Flashcards，按优先级排序（逾期 > 难度 > 间隔），排除已归档卡片';

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION get_pending_flashcards TO authenticated;

-- ============================================
-- 4. 创建归档/恢复卡片函数
-- ============================================

CREATE OR REPLACE FUNCTION archive_flashcard(
  p_flashcard_id BIGINT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 验证用户权限
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unauthorized',
      'message', '无权限操作此 Flashcard'
    );
  END IF;

  -- 更新状态为 archived
  UPDATE flashcards SET
    status = 'archived',
    next_review_at = NULL,
    updated_at = now()
  WHERE id = p_flashcard_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'not_found',
      'message', 'Flashcard 不存在'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', '卡片已归档'
  );
END;
$$;

COMMENT ON FUNCTION archive_flashcard IS '归档 Flashcard，将状态设为 archived 并清除复习时间';

CREATE OR REPLACE FUNCTION restore_flashcard(
  p_flashcard_id BIGINT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 验证用户权限
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unauthorized',
      'message', '无权限操作此 Flashcard'
    );
  END IF;

  -- 恢复为 learning 状态，重新开始复习
  UPDATE flashcards SET
    status = 'learning',
    next_review_at = now() + INTERVAL '1 day',
    interval_days = 1,
    repetitions = 0,
    updated_at = now()
  WHERE id = p_flashcard_id
    AND user_id = p_user_id
    AND status = 'archived';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'not_found',
      'message', 'Flashcard 不存在或不是归档状态'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', '卡片已恢复，将在明天复习'
  );
END;
$$;

COMMENT ON FUNCTION restore_flashcard IS '恢复已归档的 Flashcard，重置复习进度';

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION archive_flashcard TO authenticated;
GRANT EXECUTE ON FUNCTION restore_flashcard TO authenticated;

-- ============================================
-- 5. 创建获取已归档卡片函数
-- ============================================

CREATE OR REPLACE FUNCTION get_archived_flashcards(
  p_user_id UUID,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  flashcard_id BIGINT,
  bookmark_id BIGINT,
  bookmark_title VARCHAR(500),
  question TEXT,
  answer TEXT,
  archived_at TIMESTAMPTZ,
  total_reviews INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 验证用户权限
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    f.id AS flashcard_id,
    f.bookmark_id,
    b.title AS bookmark_title,
    f.question,
    f.answer,
    f.updated_at AS archived_at,
    f.repetitions AS total_reviews
  FROM flashcards f
  JOIN bookmarks b ON f.bookmark_id = b.id
  WHERE f.user_id = p_user_id
    AND f.status = 'archived'
  ORDER BY f.updated_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION get_archived_flashcards IS '获取已归档的 Flashcards 列表';

GRANT EXECUTE ON FUNCTION get_archived_flashcards TO authenticated;

-- ============================================
-- 完成
-- ============================================

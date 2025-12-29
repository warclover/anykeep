-- ============================================================================
-- 修复 review_sessions 和 get_review_stats 支持 archived 状态
-- 版本: 1.0
-- 日期: 2025-12-29
-- 描述:
--   1. 更新 review_sessions.response CHECK 约束支持 archived
--   2. 更新 get_review_stats 函数统计已归档卡片数量
-- ============================================================================

-- ============================================
-- 1. 更新 review_sessions 表的 response 约束
-- ============================================

-- 删除旧约束
ALTER TABLE review_sessions DROP CONSTRAINT IF EXISTS review_sessions_response_check;

-- 添加新约束（包含 archived）
ALTER TABLE review_sessions ADD CONSTRAINT review_sessions_response_check
  CHECK (response IN ('mastered', 'fuzzy', 'forgotten', 'archived'));

-- ============================================
-- 2. 更新 get_review_stats 函数
-- ============================================

CREATE OR REPLACE FUNCTION get_review_stats(
  p_user_id UUID,
  p_time_range VARCHAR(10) DEFAULT 'month'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date TIMESTAMPTZ;
  v_total_flashcards INT;
  v_mastered_count INT;
  v_learning_count INT;
  v_pending_count INT;
  v_archived_count INT;
  v_sessions_count INT;
  v_mastered_sessions INT;
  v_fuzzy_sessions INT;
  v_forgotten_sessions INT;
  v_archived_sessions INT;
  v_mastered_rate DECIMAL(5,2);
  v_avg_response_time INT;
BEGIN
  -- 验证用户权限
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unauthorized'
    );
  END IF;

  -- 计算时间范围
  v_start_date := CASE p_time_range
    WHEN 'week' THEN now() - INTERVAL '7 days'
    WHEN 'month' THEN now() - INTERVAL '30 days'
    ELSE '1970-01-01'::TIMESTAMPTZ
  END;

  -- Flashcard 统计（包含 archived）
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'mastered'),
    COUNT(*) FILTER (WHERE status = 'learning'),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'archived')
  INTO v_total_flashcards, v_mastered_count, v_learning_count, v_pending_count, v_archived_count
  FROM flashcards
  WHERE user_id = p_user_id;

  -- 复习会话统计（包含 archived）
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE response = 'mastered'),
    COUNT(*) FILTER (WHERE response = 'fuzzy'),
    COUNT(*) FILTER (WHERE response = 'forgotten'),
    COUNT(*) FILTER (WHERE response = 'archived'),
    AVG(response_time_ms)::INT
  INTO v_sessions_count, v_mastered_sessions, v_fuzzy_sessions, v_forgotten_sessions, v_archived_sessions, v_avg_response_time
  FROM review_sessions
  WHERE user_id = p_user_id AND created_at >= v_start_date;

  -- 计算掌握率（已掌握 + 已归档 / 总数）
  v_mastered_rate := CASE
    WHEN v_total_flashcards > 0
    THEN ((v_mastered_count + v_archived_count)::DECIMAL / v_total_flashcards * 100)
    ELSE 0
  END;

  RETURN jsonb_build_object(
    'success', true,
    'total_flashcards', v_total_flashcards,
    'mastered_count', v_mastered_count,
    'learning_count', v_learning_count,
    'pending_count', v_pending_count,
    'archived_count', v_archived_count,
    'mastered_rate', ROUND(v_mastered_rate, 1),
    'sessions_in_period', v_sessions_count,
    'mastered_sessions', v_mastered_sessions,
    'fuzzy_sessions', v_fuzzy_sessions,
    'forgotten_sessions', v_forgotten_sessions,
    'archived_sessions', v_archived_sessions,
    'avg_response_time_ms', v_avg_response_time,
    'time_range', p_time_range
  );
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION get_review_stats IS
  '获取用户的复习统计数据，包括 Flashcard 分布（含归档）和会话统计';

-- ============================================
-- 完成
-- ============================================

-- ============================================================================
-- Migration: 更新 update_flashcard_review 函数以支持 v2 理解深度评估
-- ============================================================================

/**
 * update_flashcard_review - 更新版本，支持 v2 理解深度评估
 *
 * 新增参数:
 * - p_comprehension: 理解深度反馈 (new_insight/reinforced/still_confused/skipped)
 * - p_user_note: 用户的思考记录
 */

-- 先删除旧版本函数（v1 签名）
DROP FUNCTION IF EXISTS update_flashcard_review(
  BIGINT, UUID, VARCHAR(20), INT, DECIMAL(4,2), INT, INT, VARCHAR(20)
);

-- 创建新版本函数（v2 签名，包含理解深度评估）
CREATE OR REPLACE FUNCTION update_flashcard_review(
  p_flashcard_id BIGINT,
  p_user_id UUID,
  p_response VARCHAR(20),
  p_new_interval INT,
  p_new_ease DECIMAL(4,2),
  p_new_repetitions INT,
  p_response_time_ms INT DEFAULT NULL,
  p_session_type VARCHAR(20) DEFAULT 'scheduled',
  -- v2 新增参数
  p_comprehension VARCHAR(20) DEFAULT NULL,
  p_user_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_interval INT;
  v_old_ease DECIMAL(4,2);
  v_new_status VARCHAR(20);
  v_next_review TIMESTAMPTZ;
BEGIN
  -- 验证用户权限
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unauthorized',
      'message', '无权限操作此 Flashcard'
    );
  END IF;

  -- 验证 comprehension 值（如果提供）
  IF p_comprehension IS NOT NULL AND p_comprehension NOT IN ('new_insight', 'reinforced', 'still_confused', 'skipped') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_comprehension',
      'message', '无效的理解深度值'
    );
  END IF;

  -- 获取当前值
  SELECT interval_days, ease_factor INTO v_old_interval, v_old_ease
  FROM flashcards WHERE id = p_flashcard_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'not_found',
      'message', 'Flashcard 不存在'
    );
  END IF;

  -- 计算新状态
  -- mastered 状态需要连续正确 3 次以上
  v_new_status := CASE
    WHEN p_response = 'mastered' AND p_new_repetitions >= 3 THEN 'mastered'
    WHEN p_response = 'forgotten' THEN 'pending'
    ELSE 'learning'
  END;

  -- 计算下次复习时间
  v_next_review := CASE
    WHEN v_new_status = 'mastered' THEN NULL
    ELSE now() + (p_new_interval || ' days')::INTERVAL
  END;

  -- 更新 Flashcard
  UPDATE flashcards SET
    status = v_new_status,
    ease_factor = p_new_ease,
    interval_days = p_new_interval,
    repetitions = p_new_repetitions,
    next_review_at = v_next_review,
    last_reviewed_at = now(),
    updated_at = now()
  WHERE id = p_flashcard_id AND user_id = p_user_id;

  -- 记录复习会话（包含 v2 字段）
  INSERT INTO review_sessions (
    user_id, flashcard_id, response, response_time_ms,
    prev_interval, new_interval, prev_ease, new_ease, session_type,
    -- v2 新增字段
    comprehension, user_note
  ) VALUES (
    p_user_id, p_flashcard_id, p_response, p_response_time_ms,
    v_old_interval, p_new_interval, v_old_ease, p_new_ease, p_session_type,
    p_comprehension, p_user_note
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_status', v_new_status,
    'next_review_at', v_next_review,
    'previous_interval', v_old_interval,
    'new_interval', p_new_interval,
    'comprehension_recorded', p_comprehension IS NOT NULL
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'internal_error',
      'message', SQLERRM
    );
END;
$$;

-- 更新函数注释（指定完整参数签名）
COMMENT ON FUNCTION update_flashcard_review(
  BIGINT, UUID, VARCHAR(20), INT, DECIMAL(4,2), INT, INT, VARCHAR(20), VARCHAR(20), TEXT
) IS '更新 Flashcard 复习状态，应用 SM-2 算法结果并记录复习会话（v2 支持理解深度评估）';

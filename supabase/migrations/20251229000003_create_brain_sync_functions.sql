-- ============================================================================
-- Brain-Sync (Active Recall) 数据库函数
-- 版本: 1.0
-- 日期: 2025-12-29
-- 描述: 创建主动复习功能所需的 RPC 函数
-- ============================================================================

-- ============================================
-- 函数 1: 获取待复习的 Flashcards（优先级排序）
-- ============================================
CREATE OR REPLACE FUNCTION get_pending_flashcards(
  p_user_id UUID,
  p_limit INT DEFAULT 10,
  p_included_folders BIGINT[] DEFAULT NULL,
  p_excluded_folders BIGINT[] DEFAULT NULL
)
RETURNS TABLE (
  flashcard_id BIGINT,
  bookmark_id BIGINT,
  bookmark_title TEXT,
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

-- ============================================
-- 函数 2: 更新 Flashcard 复习状态（SM-2 算法结果）
-- ============================================
CREATE OR REPLACE FUNCTION update_flashcard_review(
  p_flashcard_id BIGINT,
  p_user_id UUID,
  p_response VARCHAR(20),
  p_new_interval INT,
  p_new_ease DECIMAL(4,2),
  p_new_repetitions INT,
  p_response_time_ms INT DEFAULT NULL,
  p_session_type VARCHAR(20) DEFAULT 'scheduled'
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

  -- 记录复习会话
  INSERT INTO review_sessions (
    user_id, flashcard_id, response, response_time_ms,
    prev_interval, new_interval, prev_ease, new_ease, session_type
  ) VALUES (
    p_user_id, p_flashcard_id, p_response, p_response_time_ms,
    v_old_interval, p_new_interval, v_old_ease, p_new_ease, p_session_type
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_status', v_new_status,
    'next_review_at', v_next_review,
    'previous_interval', v_old_interval,
    'new_interval', p_new_interval
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

-- 添加函数注释
COMMENT ON FUNCTION update_flashcard_review IS
  '更新 Flashcard 复习状态，应用 SM-2 算法结果并记录复习会话';

-- ============================================
-- 函数 3: 获取复习统计
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
  v_sessions_count INT;
  v_mastered_sessions INT;
  v_fuzzy_sessions INT;
  v_forgotten_sessions INT;
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

  -- Flashcard 统计
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'mastered'),
    COUNT(*) FILTER (WHERE status = 'learning'),
    COUNT(*) FILTER (WHERE status = 'pending')
  INTO v_total_flashcards, v_mastered_count, v_learning_count, v_pending_count
  FROM flashcards
  WHERE user_id = p_user_id;

  -- 复习会话统计
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE response = 'mastered'),
    COUNT(*) FILTER (WHERE response = 'fuzzy'),
    COUNT(*) FILTER (WHERE response = 'forgotten'),
    AVG(response_time_ms)::INT
  INTO v_sessions_count, v_mastered_sessions, v_fuzzy_sessions, v_forgotten_sessions, v_avg_response_time
  FROM review_sessions
  WHERE user_id = p_user_id AND created_at >= v_start_date;

  -- 计算掌握率
  v_mastered_rate := CASE
    WHEN v_total_flashcards > 0
    THEN (v_mastered_count::DECIMAL / v_total_flashcards * 100)
    ELSE 0
  END;

  RETURN jsonb_build_object(
    'success', true,
    'total_flashcards', v_total_flashcards,
    'mastered_count', v_mastered_count,
    'learning_count', v_learning_count,
    'pending_count', v_pending_count,
    'mastered_rate', ROUND(v_mastered_rate, 1),
    'sessions_in_period', v_sessions_count,
    'mastered_sessions', v_mastered_sessions,
    'fuzzy_sessions', v_fuzzy_sessions,
    'forgotten_sessions', v_forgotten_sessions,
    'avg_response_time_ms', v_avg_response_time,
    'time_range', p_time_range
  );
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION get_review_stats IS
  '获取用户的复习统计数据，包括 Flashcard 分布和会话统计';

-- ============================================
-- 函数 4: 批量创建 Flashcards
-- ============================================
CREATE OR REPLACE FUNCTION batch_create_flashcards(
  p_user_id UUID,
  p_bookmark_id BIGINT,
  p_flashcards JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_count INT := 0;
  v_flashcard JSONB;
  v_next_review TIMESTAMPTZ;
BEGIN
  -- 验证用户权限
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unauthorized'
    );
  END IF;

  -- 验证书签存在且属于该用户
  IF NOT EXISTS (
    SELECT 1 FROM bookmarks
    WHERE id = p_bookmark_id AND user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'bookmark_not_found'
    );
  END IF;

  -- 设置初始复习时间（D1 = 24小时后）
  v_next_review := now() + INTERVAL '1 day';

  -- 遍历并插入 Flashcards
  FOR v_flashcard IN SELECT * FROM jsonb_array_elements(p_flashcards)
  LOOP
    INSERT INTO flashcards (
      user_id, bookmark_id, question, answer, source_paragraph,
      difficulty, next_review_at
    ) VALUES (
      p_user_id,
      p_bookmark_id,
      v_flashcard->>'question',
      v_flashcard->>'answer',
      v_flashcard->>'source_paragraph',
      COALESCE(v_flashcard->>'difficulty', 'medium'),
      v_next_review
    )
    ON CONFLICT (user_id, bookmark_id, question) DO NOTHING;

    IF FOUND THEN
      v_inserted_count := v_inserted_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'inserted_count', v_inserted_count,
    'next_review_at', v_next_review
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

-- 添加函数注释
COMMENT ON FUNCTION batch_create_flashcards IS
  '批量创建 Flashcards，自动设置初始复习时间，跳过重复问题';

-- ============================================
-- 函数 5: 更新每周队列完成状态
-- ============================================
CREATE OR REPLACE FUNCTION mark_flashcard_completed_in_queue(
  p_user_id UUID,
  p_flashcard_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start DATE;
  v_updated BOOLEAN := false;
BEGIN
  -- 验证用户权限
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- 获取本周一日期
  v_week_start := date_trunc('week', now())::DATE;

  -- 更新队列
  UPDATE weekly_review_queue
  SET
    completed_ids = array_append(completed_ids, p_flashcard_id),
    updated_at = now()
  WHERE user_id = p_user_id
    AND week_start = v_week_start
    AND p_flashcard_id = ANY(flashcard_ids)
    AND NOT (p_flashcard_id = ANY(completed_ids));

  v_updated := FOUND;

  RETURN jsonb_build_object(
    'success', true,
    'updated', v_updated,
    'week_start', v_week_start
  );
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION mark_flashcard_completed_in_queue IS
  '标记 Flashcard 在每周队列中已完成';

-- ============================================
-- 函数 6: 获取或创建用户复习偏好
-- ============================================
CREATE OR REPLACE FUNCTION get_or_create_review_preferences(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preferences RECORD;
BEGIN
  -- 验证用户权限
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- 尝试获取现有偏好
  SELECT * INTO v_preferences
  FROM review_preferences
  WHERE user_id = p_user_id;

  -- 如果不存在，创建默认偏好
  IF NOT FOUND THEN
    INSERT INTO review_preferences (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_preferences;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'preferences', jsonb_build_object(
      'enabled', v_preferences.enabled,
      'preferred_day', v_preferences.preferred_day,
      'preferred_time', v_preferences.preferred_time::TEXT,
      'timezone', v_preferences.timezone,
      'weekly_limit', v_preferences.weekly_limit,
      'included_folder_ids', v_preferences.included_folder_ids,
      'excluded_folder_ids', v_preferences.excluded_folder_ids,
      'notification_channel', v_preferences.notification_channel
    )
  );
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION get_or_create_review_preferences IS
  '获取用户复习偏好，如不存在则创建默认配置';

-- ============================================
-- 授予函数执行权限
-- ============================================
GRANT EXECUTE ON FUNCTION get_pending_flashcards TO authenticated;
GRANT EXECUTE ON FUNCTION update_flashcard_review TO authenticated;
GRANT EXECUTE ON FUNCTION get_review_stats TO authenticated;
GRANT EXECUTE ON FUNCTION batch_create_flashcards TO authenticated;
GRANT EXECUTE ON FUNCTION mark_flashcard_completed_in_queue TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_review_preferences TO authenticated;

-- ============================================
-- 完成
-- ============================================

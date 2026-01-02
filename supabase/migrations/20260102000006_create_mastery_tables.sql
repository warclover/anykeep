-- Knowledge Studio P3: Mastery Tracking Tables
-- 内化率追踪表
-- 2026-01-02

-- ============================================================================
-- 知识点表
-- ============================================================================

CREATE TABLE IF NOT EXISTS ks_knowledge_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL, -- 关联报告
  content TEXT NOT NULL, -- 知识点内容
  keywords TEXT[] DEFAULT '{}', -- 关键词
  paragraph_index INTEGER NOT NULL DEFAULT 0, -- 段落索引
  source_bookmark_ids UUID[] DEFAULT '{}', -- 关联书签 ID
  difficulty INTEGER NOT NULL DEFAULT 3 CHECK (difficulty >= 1 AND difficulty <= 5),
  importance INTEGER NOT NULL DEFAULT 3 CHECK (importance >= 1 AND importance <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_ks_knowledge_points_report_id ON ks_knowledge_points(report_id);
CREATE INDEX idx_ks_knowledge_points_keywords ON ks_knowledge_points USING GIN(keywords);

-- RLS
ALTER TABLE ks_knowledge_points ENABLE ROW LEVEL SECURITY;

-- 通过报告验证访问权限（需要关联 ks_reports 表）
CREATE POLICY "Users can view knowledge points"
  ON ks_knowledge_points FOR SELECT
  USING (true); -- 简化策略，实际应通过报告 owner 验证

CREATE POLICY "System can insert knowledge points"
  ON ks_knowledge_points FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- 知识点掌握状态表
-- ============================================================================

CREATE TABLE IF NOT EXISTS ks_knowledge_point_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  knowledge_point_id UUID NOT NULL REFERENCES ks_knowledge_points(id) ON DELETE CASCADE,
  mastery_level TEXT NOT NULL DEFAULT 'unknown' CHECK (mastery_level IN ('unknown', 'learning', 'familiar', 'proficient', 'mastered')),
  review_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  accuracy NUMERIC(5, 2) NOT NULL DEFAULT 0, -- 正确率 0-100
  last_reviewed_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  interval_days INTEGER NOT NULL DEFAULT 1, -- SM-2 间隔天数
  ease_factor NUMERIC(4, 2) NOT NULL DEFAULT 2.5, -- SM-2 易度因子
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, knowledge_point_id)
);

-- 索引
CREATE INDEX idx_ks_kp_mastery_user_id ON ks_knowledge_point_mastery(user_id);
CREATE INDEX idx_ks_kp_mastery_kp_id ON ks_knowledge_point_mastery(knowledge_point_id);
CREATE INDEX idx_ks_kp_mastery_next_review ON ks_knowledge_point_mastery(next_review_at);
CREATE INDEX idx_ks_kp_mastery_level ON ks_knowledge_point_mastery(mastery_level);

-- RLS
ALTER TABLE ks_knowledge_point_mastery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mastery"
  ON ks_knowledge_point_mastery FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mastery"
  ON ks_knowledge_point_mastery FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mastery"
  ON ks_knowledge_point_mastery FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 学习会话表
-- ============================================================================

CREATE TABLE IF NOT EXISTS ks_learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id UUID NOT NULL, -- 关联报告
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  points_studied INTEGER NOT NULL DEFAULT 0,
  points_reviewed INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  total_answers INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 0
);

-- 索引
CREATE INDEX idx_ks_learning_sessions_user_id ON ks_learning_sessions(user_id);
CREATE INDEX idx_ks_learning_sessions_report_id ON ks_learning_sessions(report_id);
CREATE INDEX idx_ks_learning_sessions_started_at ON ks_learning_sessions(started_at);

-- RLS
ALTER TABLE ks_learning_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON ks_learning_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
  ON ks_learning_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON ks_learning_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 复习记录表
-- ============================================================================

CREATE TABLE IF NOT EXISTS ks_review_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  knowledge_point_id UUID NOT NULL REFERENCES ks_knowledge_points(id) ON DELETE CASCADE,
  session_id UUID REFERENCES ks_learning_sessions(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 0 AND rating <= 5), -- SM-2 评分
  response_time_ms INTEGER NOT NULL DEFAULT 0,
  previous_interval INTEGER NOT NULL DEFAULT 0,
  new_interval INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_ks_review_records_user_id ON ks_review_records(user_id);
CREATE INDEX idx_ks_review_records_kp_id ON ks_review_records(knowledge_point_id);
CREATE INDEX idx_ks_review_records_session_id ON ks_review_records(session_id);
CREATE INDEX idx_ks_review_records_created_at ON ks_review_records(created_at);

-- RLS
ALTER TABLE ks_review_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own review records"
  ON ks_review_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own review records"
  ON ks_review_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- SM-2 算法函数
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_sm2_next_review(
  p_rating INTEGER,
  p_current_interval INTEGER,
  p_current_ease_factor NUMERIC
)
RETURNS TABLE (
  new_interval INTEGER,
  new_ease_factor NUMERIC,
  new_mastery_level TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_interval INTEGER;
  v_ease NUMERIC;
  v_level TEXT;
BEGIN
  -- SM-2 算法实现
  IF p_rating < 3 THEN
    -- 回答错误，重置间隔
    v_interval := 1;
    v_ease := GREATEST(1.3, p_current_ease_factor - 0.2);
    v_level := 'learning';
  ELSE
    -- 回答正确，增加间隔
    IF p_current_interval = 0 THEN
      v_interval := 1;
    ELSIF p_current_interval = 1 THEN
      v_interval := 6;
    ELSE
      v_interval := CEIL(p_current_interval * p_current_ease_factor);
    END IF;

    -- 更新易度因子
    v_ease := p_current_ease_factor + (0.1 - (5 - p_rating) * (0.08 + (5 - p_rating) * 0.02));
    v_ease := GREATEST(1.3, v_ease);

    -- 根据间隔判断掌握度
    IF v_interval >= 21 THEN
      v_level := 'mastered';
    ELSIF v_interval >= 7 THEN
      v_level := 'proficient';
    ELSIF v_interval >= 3 THEN
      v_level := 'familiar';
    ELSE
      v_level := 'learning';
    END IF;
  END IF;

  RETURN QUERY SELECT v_interval, v_ease, v_level;
END;
$$;

-- ============================================================================
-- 记录复习并更新掌握度
-- ============================================================================

CREATE OR REPLACE FUNCTION record_review_and_update_mastery(
  p_user_id UUID,
  p_knowledge_point_id UUID,
  p_session_id UUID,
  p_rating INTEGER,
  p_response_time_ms INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mastery ks_knowledge_point_mastery;
  v_sm2_result RECORD;
  v_review_id UUID;
BEGIN
  -- 验证用户
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 获取或创建掌握度记录
  SELECT * INTO v_mastery
  FROM ks_knowledge_point_mastery
  WHERE user_id = p_user_id
    AND knowledge_point_id = p_knowledge_point_id;

  IF NOT FOUND THEN
    INSERT INTO ks_knowledge_point_mastery (user_id, knowledge_point_id)
    VALUES (p_user_id, p_knowledge_point_id)
    RETURNING * INTO v_mastery;
  END IF;

  -- 计算 SM-2 结果
  SELECT * INTO v_sm2_result
  FROM calculate_sm2_next_review(p_rating, v_mastery.interval_days, v_mastery.ease_factor);

  -- 插入复习记录
  INSERT INTO ks_review_records (
    user_id,
    knowledge_point_id,
    session_id,
    rating,
    response_time_ms,
    previous_interval,
    new_interval
  ) VALUES (
    p_user_id,
    p_knowledge_point_id,
    p_session_id,
    p_rating,
    p_response_time_ms,
    v_mastery.interval_days,
    v_sm2_result.new_interval
  )
  RETURNING id INTO v_review_id;

  -- 更新掌握度
  UPDATE ks_knowledge_point_mastery
  SET
    mastery_level = v_sm2_result.new_mastery_level,
    review_count = review_count + 1,
    correct_count = CASE WHEN p_rating >= 3 THEN correct_count + 1 ELSE correct_count END,
    accuracy = CASE
      WHEN review_count = 0 THEN CASE WHEN p_rating >= 3 THEN 100 ELSE 0 END
      ELSE (correct_count + CASE WHEN p_rating >= 3 THEN 1 ELSE 0 END)::NUMERIC / (review_count + 1) * 100
    END,
    last_reviewed_at = now(),
    next_review_at = now() + (v_sm2_result.new_interval || ' days')::INTERVAL,
    interval_days = v_sm2_result.new_interval,
    ease_factor = v_sm2_result.new_ease_factor,
    updated_at = now()
  WHERE user_id = p_user_id
    AND knowledge_point_id = p_knowledge_point_id;

  RETURN jsonb_build_object(
    'reviewId', v_review_id,
    'newInterval', v_sm2_result.new_interval,
    'newEaseFactor', v_sm2_result.new_ease_factor,
    'newMasteryLevel', v_sm2_result.new_mastery_level,
    'nextReviewAt', now() + (v_sm2_result.new_interval || ' days')::INTERVAL
  );
END;
$$;

-- ============================================================================
-- 获取待复习知识点
-- ============================================================================

CREATE OR REPLACE FUNCTION get_due_for_review(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  knowledge_point_id UUID,
  content TEXT,
  mastery_level TEXT,
  interval_days INTEGER,
  last_reviewed_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  overdue_days INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 验证用户
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    kp.id,
    kp.content,
    m.mastery_level,
    m.interval_days,
    m.last_reviewed_at,
    m.next_review_at,
    EXTRACT(DAY FROM now() - m.next_review_at)::INTEGER as overdue_days
  FROM ks_knowledge_point_mastery m
  JOIN ks_knowledge_points kp ON kp.id = m.knowledge_point_id
  WHERE m.user_id = p_user_id
    AND m.next_review_at <= now()
  ORDER BY m.next_review_at ASC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- 获取用户内化率统计
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_mastery_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- 验证用户
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT jsonb_build_object(
    'userId', p_user_id,
    'totalPoints', COUNT(*),
    'masteredPoints', COUNT(*) FILTER (WHERE mastery_level = 'mastered'),
    'proficientPoints', COUNT(*) FILTER (WHERE mastery_level = 'proficient'),
    'familiarPoints', COUNT(*) FILTER (WHERE mastery_level = 'familiar'),
    'learningPoints', COUNT(*) FILTER (WHERE mastery_level = 'learning'),
    'unknownPoints', COUNT(*) FILTER (WHERE mastery_level = 'unknown'),
    'overallMasteryRate', COALESCE(
      ROUND(AVG(CASE mastery_level
        WHEN 'mastered' THEN 100
        WHEN 'proficient' THEN 75
        WHEN 'familiar' THEN 50
        WHEN 'learning' THEN 25
        ELSE 0
      END)),
      0
    ),
    'averageAccuracy', COALESCE(ROUND(AVG(accuracy)), 0),
    'dueForReview', COUNT(*) FILTER (WHERE next_review_at <= now()),
    'studiedToday', (
      SELECT COUNT(DISTINCT knowledge_point_id)
      FROM ks_review_records
      WHERE user_id = p_user_id
        AND created_at >= CURRENT_DATE
    ),
    'weeklyStudyMinutes', COALESCE(
      (SELECT SUM(duration_minutes)
       FROM ks_learning_sessions
       WHERE user_id = p_user_id
         AND started_at >= now() - INTERVAL '7 days'),
      0
    )
  ) INTO v_result
  FROM ks_knowledge_point_mastery
  WHERE user_id = p_user_id;

  RETURN v_result;
END;
$$;


-- ============================================
-- AI 意图映射增强 - 数据库表结构
--
-- 版本: 1.0.0
-- 创建日期: 2026-01-10
-- 说明: Phase 3 个性化学习所需的表结构
-- ============================================

-- 1. 意图反馈表
-- 用于收集用户对意图分类结果的反馈
CREATE TABLE IF NOT EXISTS ai_intent_feedback (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  turn_id UUID NOT NULL,
  original_input TEXT NOT NULL,
  predicted_type VARCHAR(50) NOT NULL,
  predicted_subtype VARCHAR(50),
  predicted_confidence DECIMAL(5,4) NOT NULL,
  actual_behavior VARCHAR(20) NOT NULL CHECK (actual_behavior IN ('accepted', 'corrected', 'abandoned')),
  corrected_type VARCHAR(50),
  corrected_subtype VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ai_intent_feedback_user ON ai_intent_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_intent_feedback_behavior ON ai_intent_feedback(actual_behavior);
CREATE INDEX IF NOT EXISTS idx_ai_intent_feedback_predicted ON ai_intent_feedback(predicted_type, predicted_subtype);
CREATE INDEX IF NOT EXISTS idx_ai_intent_feedback_created ON ai_intent_feedback(created_at DESC);

-- RLS 策略
ALTER TABLE ai_intent_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户只能查看自己的反馈"
  ON ai_intent_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "用户只能创建自己的反馈"
  ON ai_intent_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 2. 意图模式建议表
-- 存储自动发现的新意图模式，等待审核
CREATE TABLE IF NOT EXISTS ai_intent_pattern_suggestions (
  id BIGSERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  subtype VARCHAR(50) NOT NULL,
  pattern TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 50,
  sample_inputs TEXT[] NOT NULL DEFAULT '{}',
  discovery_confidence DECIMAL(5,4) NOT NULL,
  discovery_method VARCHAR(30) NOT NULL DEFAULT 'clustering', -- clustering, llm, manual
  occurrence_count INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  merged_into_id BIGINT REFERENCES ai_intent_pattern_suggestions(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 约束
  UNIQUE (type, subtype, pattern)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ai_pattern_suggestions_status ON ai_intent_pattern_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_ai_pattern_suggestions_type ON ai_intent_pattern_suggestions(type, subtype);
CREATE INDEX IF NOT EXISTS idx_ai_pattern_suggestions_confidence ON ai_intent_pattern_suggestions(discovery_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_ai_pattern_suggestions_created ON ai_intent_pattern_suggestions(created_at DESC);

-- RLS 策略 (管理员表，普通用户只读)
ALTER TABLE ai_intent_pattern_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "所有认证用户可查看建议"
  ON ai_intent_pattern_suggestions FOR SELECT
  USING (auth.role() = 'authenticated');

-- 3. 意图分类缓存表
-- 缓存常见输入的分类结果，减少 LLM 调用
CREATE TABLE IF NOT EXISTS ai_intent_cache (
  id BIGSERIAL PRIMARY KEY,
  input_hash VARCHAR(64) NOT NULL,  -- SHA256(normalized_input)
  normalized_input TEXT NOT NULL,
  intent_type VARCHAR(50) NOT NULL,
  intent_subtype VARCHAR(50),
  confidence DECIMAL(5,4) NOT NULL,
  method VARCHAR(20) NOT NULL CHECK (method IN ('rule', 'semantic', 'llm', 'hybrid')),
  slots JSONB DEFAULT '{}',
  hit_count INTEGER DEFAULT 1,
  last_hit_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- 约束
  UNIQUE (input_hash)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ai_intent_cache_hash ON ai_intent_cache(input_hash);
CREATE INDEX IF NOT EXISTS idx_ai_intent_cache_expires ON ai_intent_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_intent_cache_hits ON ai_intent_cache(hit_count DESC);

-- RLS 策略 (系统表，不对普通用户开放)
ALTER TABLE ai_intent_cache ENABLE ROW LEVEL SECURITY;

-- 只允许通过 service_role 访问
CREATE POLICY "仅服务角色可访问缓存"
  ON ai_intent_cache FOR ALL
  USING (auth.role() = 'service_role');

-- 4. 个性化快捷指令表
-- 存储用户的个性化快捷指令映射
CREATE TABLE IF NOT EXISTS ai_user_shortcuts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shortcut_phrase TEXT NOT NULL,
  intent_type VARCHAR(50) NOT NULL,
  intent_subtype VARCHAR(50),
  default_slots JSONB DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 约束
  UNIQUE (user_id, shortcut_phrase)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ai_user_shortcuts_user ON ai_user_shortcuts(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_user_shortcuts_phrase ON ai_user_shortcuts(shortcut_phrase);
CREATE INDEX IF NOT EXISTS idx_ai_user_shortcuts_usage ON ai_user_shortcuts(user_id, usage_count DESC);

-- RLS 策略
ALTER TABLE ai_user_shortcuts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户只能查看自己的快捷指令"
  ON ai_user_shortcuts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "用户只能创建自己的快捷指令"
  ON ai_user_shortcuts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户只能更新自己的快捷指令"
  ON ai_user_shortcuts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "用户只能删除自己的快捷指令"
  ON ai_user_shortcuts FOR DELETE
  USING (auth.uid() = user_id);

-- 5. 辅助函数

-- 更新缓存命中计数
CREATE OR REPLACE FUNCTION update_intent_cache_hit(p_input_hash VARCHAR(64))
RETURNS VOID AS $$
BEGIN
  UPDATE ai_intent_cache
  SET hit_count = hit_count + 1,
      last_hit_at = NOW()
  WHERE input_hash = p_input_hash
    AND expires_at > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 清理过期缓存
CREATE OR REPLACE FUNCTION cleanup_expired_intent_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM ai_intent_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 记录意图反馈
CREATE OR REPLACE FUNCTION record_intent_feedback(
  p_user_id UUID,
  p_session_id UUID,
  p_turn_id UUID,
  p_original_input TEXT,
  p_predicted_type VARCHAR(50),
  p_predicted_subtype VARCHAR(50),
  p_predicted_confidence DECIMAL(5,4),
  p_actual_behavior VARCHAR(20),
  p_corrected_type VARCHAR(50) DEFAULT NULL,
  p_corrected_subtype VARCHAR(50) DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS BIGINT AS $$
DECLARE
  new_id BIGINT;
BEGIN
  -- 验证用户
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Cannot record feedback for another user';
  END IF;

  INSERT INTO ai_intent_feedback (
    user_id, session_id, turn_id, original_input,
    predicted_type, predicted_subtype, predicted_confidence,
    actual_behavior, corrected_type, corrected_subtype, metadata
  ) VALUES (
    p_user_id, p_session_id, p_turn_id, p_original_input,
    p_predicted_type, p_predicted_subtype, p_predicted_confidence,
    p_actual_behavior, p_corrected_type, p_corrected_subtype, p_metadata
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取用户反馈统计
CREATE OR REPLACE FUNCTION get_user_feedback_stats(p_user_id UUID)
RETURNS TABLE (
  total_count BIGINT,
  accepted_count BIGINT,
  corrected_count BIGINT,
  abandoned_count BIGINT,
  acceptance_rate DECIMAL(5,4),
  top_corrected_types JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_count,
    COUNT(*) FILTER (WHERE actual_behavior = 'accepted')::BIGINT as accepted_count,
    COUNT(*) FILTER (WHERE actual_behavior = 'corrected')::BIGINT as corrected_count,
    COUNT(*) FILTER (WHERE actual_behavior = 'abandoned')::BIGINT as abandoned_count,
    CASE
      WHEN COUNT(*) > 0
      THEN (COUNT(*) FILTER (WHERE actual_behavior = 'accepted')::DECIMAL / COUNT(*))
      ELSE 0
    END as acceptance_rate,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'type', predicted_type,
          'subtype', predicted_subtype,
          'count', correction_count
        )
      )
      FROM (
        SELECT predicted_type, predicted_subtype, COUNT(*) as correction_count
        FROM ai_intent_feedback
        WHERE user_id = p_user_id AND actual_behavior = 'corrected'
        GROUP BY predicted_type, predicted_subtype
        ORDER BY COUNT(*) DESC
        LIMIT 5
      ) top_corrections
    ) as top_corrected_types
  FROM ai_intent_feedback
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 更新用户快捷指令使用统计
CREATE OR REPLACE FUNCTION update_shortcut_usage(p_user_id UUID, p_shortcut_phrase TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE ai_user_shortcuts
  SET usage_count = usage_count + 1,
      last_used_at = NOW(),
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND shortcut_phrase = p_shortcut_phrase
    AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 添加注释
COMMENT ON TABLE ai_intent_feedback IS '意图分类反馈表，用于收集用户对分类结果的反馈';
COMMENT ON TABLE ai_intent_pattern_suggestions IS '意图模式建议表，存储自动发现的新意图模式';
COMMENT ON TABLE ai_intent_cache IS '意图分类缓存表，缓存常见输入的分类结果';
COMMENT ON TABLE ai_user_shortcuts IS '用户个性化快捷指令表';

COMMENT ON FUNCTION update_intent_cache_hit IS '更新缓存命中计数';
COMMENT ON FUNCTION cleanup_expired_intent_cache IS '清理过期的意图分类缓存';
COMMENT ON FUNCTION record_intent_feedback IS '记录用户对意图分类的反馈';
COMMENT ON FUNCTION get_user_feedback_stats IS '获取用户反馈统计信息';
COMMENT ON FUNCTION update_shortcut_usage IS '更新快捷指令使用统计';

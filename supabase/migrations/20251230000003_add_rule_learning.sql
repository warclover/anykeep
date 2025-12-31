-- 文件: supabase/migrations/20251230000003_add_rule_learning.sql
-- 描述: Phase 3 - 规则学习
-- 版本: 1.0.0
-- 日期: 2025-12-30

-- ============================================================
-- 1. 创建用户纠正记录表
-- ============================================================

CREATE TABLE IF NOT EXISTS user_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 原始操作
  original_action JSONB NOT NULL,

  -- 纠正后的操作
  corrected_action JSONB NOT NULL,

  -- 上下文
  context JSONB NOT NULL DEFAULT '{}',

  -- 是否已用于规则提取
  rule_extracted BOOLEAN NOT NULL DEFAULT FALSE,
  extracted_rule_id TEXT,

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 添加表注释
COMMENT ON TABLE user_corrections IS 'Stores user correction records for AI rule learning';
COMMENT ON COLUMN user_corrections.original_action IS 'The original AI action before user correction';
COMMENT ON COLUMN user_corrections.corrected_action IS 'The corrected action after user modification';
COMMENT ON COLUMN user_corrections.context IS 'Context data at the time of correction';
COMMENT ON COLUMN user_corrections.rule_extracted IS 'Whether this correction has been used for rule extraction';
COMMENT ON COLUMN user_corrections.extracted_rule_id IS 'ID of the rule extracted from this correction';

-- 索引
CREATE INDEX idx_corrections_unprocessed
  ON user_corrections(user_id, rule_extracted)
  WHERE NOT rule_extracted;

CREATE INDEX idx_corrections_user_time
  ON user_corrections(user_id, created_at DESC);

-- RLS 策略
ALTER TABLE user_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own corrections"
  ON user_corrections FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 2. 扩展 ai_preferences：添加 customRules 字段
-- ============================================================

-- 添加自定义规则的 RPC 函数
CREATE OR REPLACE FUNCTION add_ai_custom_rule(
  p_user_id UUID,
  p_rule JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_rules JSONB;
BEGIN
  SELECT COALESCE(ai_preferences->'explicit'->'customRules', '[]'::JSONB)
  INTO existing_rules
  FROM profiles
  WHERE id = p_user_id;

  UPDATE profiles
  SET ai_preferences = jsonb_set(
    jsonb_set(
      COALESCE(ai_preferences, '{}'::JSONB),
      '{explicit}',
      COALESCE(ai_preferences->'explicit', '{}'::JSONB)
    ),
    '{explicit,customRules}',
    existing_rules || jsonb_build_array(p_rule)
  )
  WHERE id = p_user_id;
END;
$$;

COMMENT ON FUNCTION add_ai_custom_rule IS 'Adds a custom AI rule to user preferences';

-- 删除自定义规则的 RPC 函数
CREATE OR REPLACE FUNCTION remove_ai_custom_rule(
  p_user_id UUID,
  p_rule_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_rules JSONB;
  new_rules JSONB;
BEGIN
  SELECT COALESCE(ai_preferences->'explicit'->'customRules', '[]'::JSONB)
  INTO existing_rules
  FROM profiles
  WHERE id = p_user_id;

  SELECT jsonb_agg(rule)
  INTO new_rules
  FROM jsonb_array_elements(existing_rules) AS rule
  WHERE rule->>'id' != p_rule_id;

  UPDATE profiles
  SET ai_preferences = jsonb_set(
    COALESCE(ai_preferences, '{}'::JSONB),
    '{explicit,customRules}',
    COALESCE(new_rules, '[]'::JSONB)
  )
  WHERE id = p_user_id;
END;
$$;

COMMENT ON FUNCTION remove_ai_custom_rule IS 'Removes a custom AI rule from user preferences by rule ID';

-- ============================================================
-- 3. RPC 函数：记录用户纠正
-- ============================================================

CREATE OR REPLACE FUNCTION record_user_correction(
  p_user_id UUID,
  p_original_action JSONB,
  p_corrected_action JSONB,
  p_context JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO user_corrections (user_id, original_action, corrected_action, context)
  VALUES (p_user_id, p_original_action, p_corrected_action, p_context)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

COMMENT ON FUNCTION record_user_correction IS 'Records a user correction for AI rule learning';

-- ============================================================
-- 4. RPC 函数：获取未处理的纠正记录
-- ============================================================

CREATE OR REPLACE FUNCTION get_unprocessed_corrections(
  p_user_id UUID,
  p_limit INT DEFAULT 50
)
RETURNS SETOF user_corrections
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM user_corrections
  WHERE user_id = p_user_id
    AND NOT rule_extracted
  ORDER BY created_at DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_unprocessed_corrections IS 'Gets unprocessed user corrections for rule extraction';

-- ============================================================
-- 5. RPC 函数：标记纠正记录已处理
-- ============================================================

CREATE OR REPLACE FUNCTION mark_correction_processed(
  p_correction_id UUID,
  p_extracted_rule_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_corrections
  SET
    rule_extracted = TRUE,
    extracted_rule_id = p_extracted_rule_id
  WHERE id = p_correction_id;
END;
$$;

COMMENT ON FUNCTION mark_correction_processed IS 'Marks a correction record as processed with the extracted rule ID';

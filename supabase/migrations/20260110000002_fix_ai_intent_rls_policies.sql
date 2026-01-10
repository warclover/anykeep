-- ============================================
-- AI 意图映射增强 - RLS 策略补全
--
-- 版本: 1.0.0
-- 创建日期: 2026-01-10
-- 说明: 修复 ai_intent_pattern_suggestions 表缺失的 RLS 策略
-- 关联 Issue: Code Review #1
-- ============================================

-- 1. 为 ai_intent_pattern_suggestions 添加 INSERT 策略
-- 通过 service_role 插入（由应用层控制）
CREATE POLICY "系统可插入模式建议"
  ON ai_intent_pattern_suggestions FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 2. 为 ai_intent_pattern_suggestions 添加 UPDATE 策略
-- 管理员审批或系统更新
CREATE POLICY "管理员可审批建议"
  ON ai_intent_pattern_suggestions FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR (approved_by IS NOT NULL AND auth.uid() = approved_by)
  );

-- 3. 为 ai_intent_pattern_suggestions 添加 DELETE 策略
-- 仅 service_role 可删除（清理已合并或已拒绝的记录）
CREATE POLICY "系统可删除模式建议"
  ON ai_intent_pattern_suggestions FOR DELETE
  USING (auth.role() = 'service_role');

-- 4. 添加 RPC 函数用于安全地插入模式建议
CREATE OR REPLACE FUNCTION suggest_intent_pattern(
  p_type VARCHAR(50),
  p_subtype VARCHAR(50),
  p_pattern TEXT,
  p_weight INTEGER DEFAULT 50,
  p_sample_inputs TEXT[] DEFAULT '{}',
  p_discovery_confidence DECIMAL(5,4) DEFAULT 0.7,
  p_discovery_method VARCHAR(30) DEFAULT 'clustering'
)
RETURNS BIGINT AS $$
DECLARE
  new_id BIGINT;
BEGIN
  -- 检查是否已存在相同模式
  SELECT id INTO new_id
  FROM ai_intent_pattern_suggestions
  WHERE type = p_type
    AND subtype = p_subtype
    AND pattern = p_pattern;

  IF new_id IS NOT NULL THEN
    -- 已存在，增加出现次数
    UPDATE ai_intent_pattern_suggestions
    SET occurrence_count = occurrence_count + 1,
        updated_at = NOW()
    WHERE id = new_id;
    RETURN new_id;
  END IF;

  -- 插入新建议
  INSERT INTO ai_intent_pattern_suggestions (
    type, subtype, pattern, weight, sample_inputs,
    discovery_confidence, discovery_method
  ) VALUES (
    p_type, p_subtype, p_pattern, p_weight, p_sample_inputs,
    p_discovery_confidence, p_discovery_method
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 添加审批模式建议的 RPC 函数
CREATE OR REPLACE FUNCTION approve_intent_pattern(
  p_suggestion_id BIGINT,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_status VARCHAR(20);
BEGIN
  -- 获取当前状态
  SELECT status INTO v_status
  FROM ai_intent_pattern_suggestions
  WHERE id = p_suggestion_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Pattern suggestion not found: %', p_suggestion_id;
  END IF;

  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'Pattern suggestion is not pending: %', v_status;
  END IF;

  IF p_rejection_reason IS NOT NULL THEN
    -- 拒绝
    UPDATE ai_intent_pattern_suggestions
    SET status = 'rejected',
        rejection_reason = p_rejection_reason,
        updated_at = NOW()
    WHERE id = p_suggestion_id;
  ELSE
    -- 批准
    UPDATE ai_intent_pattern_suggestions
    SET status = 'approved',
        approved_by = auth.uid(),
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_suggestion_id;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 添加注释
COMMENT ON FUNCTION suggest_intent_pattern IS '安全地插入意图模式建议，支持去重和计数';
COMMENT ON FUNCTION approve_intent_pattern IS '审批意图模式建议（批准或拒绝）';

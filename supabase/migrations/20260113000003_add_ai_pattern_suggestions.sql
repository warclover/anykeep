-- ============================================
-- AI 意图模式建议表（候选规则）
--
-- 版本: 1.0.0
-- 创建日期: 2026-01-13
-- 说明: 存储 RuleMiner 自动挖掘的候选规则
-- ============================================

-- 1. 创建候选规则表
CREATE TABLE IF NOT EXISTS ai_intent_pattern_suggestions (
  id BIGSERIAL PRIMARY KEY,

  -- 规则定义
  type VARCHAR(50) NOT NULL,
  subtype VARCHAR(50) DEFAULT '',
  pattern TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 60,

  -- 发现元数据
  sample_inputs TEXT[] DEFAULT '{}',
  discovery_confidence DECIMAL(5,4) NOT NULL DEFAULT 0,
  discovery_method VARCHAR(20) NOT NULL DEFAULT 'clustering',

  -- 审核状态
  status VARCHAR(20) NOT NULL DEFAULT 'pending_review',
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 唯一约束：同一意图下的模式不重复
  UNIQUE(type, subtype, pattern)
);

-- 2. 索引
CREATE INDEX IF NOT EXISTS idx_ai_pattern_suggestions_status
  ON ai_intent_pattern_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_ai_pattern_suggestions_type
  ON ai_intent_pattern_suggestions(type, subtype);
CREATE INDEX IF NOT EXISTS idx_ai_pattern_suggestions_created
  ON ai_intent_pattern_suggestions(created_at DESC);

-- 3. RLS 策略 (系统表，仅服务角色可访问)
ALTER TABLE ai_intent_pattern_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "仅服务角色可访问候选规则"
  ON ai_intent_pattern_suggestions FOR ALL
  USING (auth.role() = 'service_role');

-- 4. 自动更新 updated_at 触发器
CREATE OR REPLACE FUNCTION update_ai_pattern_suggestions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_pattern_suggestions_updated_at ON ai_intent_pattern_suggestions;
CREATE TRIGGER trg_ai_pattern_suggestions_updated_at
  BEFORE UPDATE ON ai_intent_pattern_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_pattern_suggestions_updated_at();

-- 5. 添加注释
COMMENT ON TABLE ai_intent_pattern_suggestions IS 'AI 意图模式候选规则表，存储自动挖掘的规则';
COMMENT ON COLUMN ai_intent_pattern_suggestions.type IS '意图类型';
COMMENT ON COLUMN ai_intent_pattern_suggestions.subtype IS '意图子类型';
COMMENT ON COLUMN ai_intent_pattern_suggestions.pattern IS '正则表达式模式';
COMMENT ON COLUMN ai_intent_pattern_suggestions.weight IS '初始权重（默认 60）';
COMMENT ON COLUMN ai_intent_pattern_suggestions.sample_inputs IS '示例输入（用于验证）';
COMMENT ON COLUMN ai_intent_pattern_suggestions.discovery_confidence IS '发现置信度';
COMMENT ON COLUMN ai_intent_pattern_suggestions.discovery_method IS '发现方法（clustering/llm/manual）';
COMMENT ON COLUMN ai_intent_pattern_suggestions.status IS '状态（pending_review/approved/rejected/merged）';
COMMENT ON COLUMN ai_intent_pattern_suggestions.reviewed_at IS '审核时间';
COMMENT ON COLUMN ai_intent_pattern_suggestions.reviewed_by IS '审核人';

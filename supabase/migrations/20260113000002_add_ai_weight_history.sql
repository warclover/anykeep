-- ============================================
-- AI 权重变更历史表
--
-- 版本: 1.0.0
-- 创建日期: 2026-01-13
-- 说明: 记录意图分类规则权重的变更历史
-- ============================================

-- 1. 创建权重历史表
CREATE TABLE IF NOT EXISTS ai_weight_history (
  id BIGSERIAL PRIMARY KEY,
  intent_type VARCHAR(50) NOT NULL,
  intent_subtype VARCHAR(50),
  old_weight INTEGER NOT NULL,
  new_weight INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  confidence DECIMAL(5,4) NOT NULL,
  trigger_count INTEGER NOT NULL,
  accuracy DECIMAL(5,4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ai_weight_history_intent ON ai_weight_history(intent_type, intent_subtype);
CREATE INDEX IF NOT EXISTS idx_ai_weight_history_created ON ai_weight_history(created_at DESC);

-- RLS 策略 (系统表，仅服务角色可访问)
ALTER TABLE ai_weight_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "仅服务角色可访问权重历史"
  ON ai_weight_history FOR ALL
  USING (auth.role() = 'service_role');

-- 添加注释
COMMENT ON TABLE ai_weight_history IS 'AI 规则权重变更历史表';
COMMENT ON COLUMN ai_weight_history.intent_type IS '意图类型';
COMMENT ON COLUMN ai_weight_history.intent_subtype IS '意图子类型';
COMMENT ON COLUMN ai_weight_history.old_weight IS '变更前权重';
COMMENT ON COLUMN ai_weight_history.new_weight IS '变更后权重';
COMMENT ON COLUMN ai_weight_history.delta IS '权重变化量';
COMMENT ON COLUMN ai_weight_history.reason IS '变更原因';
COMMENT ON COLUMN ai_weight_history.confidence IS '变更置信度';
COMMENT ON COLUMN ai_weight_history.trigger_count IS '触发次数';
COMMENT ON COLUMN ai_weight_history.accuracy IS '准确率';

-- ============================================
-- AI 系统配置表
--
-- 版本: 1.0.0
-- 创建日期: 2026-01-13
-- 说明: 存储 AI 系统级配置（如置信度校准参数）
-- ============================================

-- 1. 创建系统配置表
CREATE TABLE IF NOT EXISTS ai_system_config (
  id BIGSERIAL PRIMARY KEY,
  key VARCHAR(100) NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ai_system_config_key ON ai_system_config(key);

-- RLS 策略 (系统表，仅服务角色可访问)
ALTER TABLE ai_system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "仅服务角色可访问系统配置"
  ON ai_system_config FOR ALL
  USING (auth.role() = 'service_role');

-- 2. 自动更新 updated_at 触发器
CREATE OR REPLACE FUNCTION update_ai_system_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_system_config_updated_at ON ai_system_config;
CREATE TRIGGER trg_ai_system_config_updated_at
  BEFORE UPDATE ON ai_system_config
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_system_config_updated_at();

-- 3. 初始配置数据
INSERT INTO ai_system_config (key, value, description) VALUES
(
  'confidence_calibration_params',
  '{
    "weights": [0.6, 0.1, 0.15, 0.05, 0.05, 0.05],
    "bias": -0.3,
    "updatedAt": 0,
    "sampleCount": 0
  }',
  '置信度校准器 Platt Scaling 参数'
),
(
  'intent_classifier_weights',
  '{
    "version": "1.0.0",
    "rules": {},
    "updatedAt": 0
  }',
  '意图分类器规则权重配置'
)
ON CONFLICT (key) DO NOTHING;

-- 添加注释
COMMENT ON TABLE ai_system_config IS 'AI 系统级配置表，存储各模块的可调参数';
COMMENT ON COLUMN ai_system_config.key IS '配置项唯一标识';
COMMENT ON COLUMN ai_system_config.value IS '配置值（JSONB 格式）';
COMMENT ON COLUMN ai_system_config.description IS '配置项说明';

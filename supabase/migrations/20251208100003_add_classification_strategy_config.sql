-- ============================================================================
-- V4.0 配置中心化: 分类策略配置表
-- ============================================================================
-- 支持场景化权重配置、阈值配置、热更新

-- 1. 创建策略配置表
CREATE TABLE IF NOT EXISTS classification_strategy_config (
  id SERIAL PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,              -- 配置键 (如 'default', 'user:{userId}')
  version TEXT NOT NULL DEFAULT 'v4.0',         -- 配置版本

  -- 场景化权重配置
  scenario_weights JSONB NOT NULL DEFAULT '{
    "cold_start": {"vector": 0.8, "universal": 0.2, "history": 0.0, "fingerprint": 0.0, "tag": 0.0},
    "learning": {"vector": 0.5, "history": 0.3, "fingerprint": 0.1, "universal": 0.1, "tag": 0.0},
    "mature": {"vector": 0.3, "history": 0.4, "fingerprint": 0.2, "tag": 0.1, "universal": 0.0}
  }'::jsonb,

  -- 全局阈值配置
  thresholds JSONB NOT NULL DEFAULT '{
    "direct_lock": 0.92,
    "high_confidence": 0.80,
    "medium_confidence": 0.50,
    "ai_confirm": 0.65,
    "auto_create": 0.75,
    "correction_cache_min": 0.60
  }'::jsonb,

  -- 功能开关
  feature_flags JSONB NOT NULL DEFAULT '{
    "enable_tiered_optimization": true,
    "enable_correction_cache": true,
    "enable_tracing": true,
    "enable_dynamic_weights": true,
    "enable_cot_prompt": true,
    "enable_reranking": false,
    "enable_auto_create": true
  }'::jsonb,

  -- 匹配器配置
  matcher_config JSONB NOT NULL DEFAULT '{
    "knn_direct": {"threshold": 0.92, "max_candidates": 5},
    "vector": {"top_k": 10, "min_score": 0.3},
    "history": {"lookback_days": 90, "min_actions": 3},
    "fingerprint": {"min_tag_match": 2},
    "universal": {"enabled": true},
    "tag": {"exact_match_boost": 1.5}
  }'::jsonb,

  -- AI 配置
  ai_config JSONB NOT NULL DEFAULT '{
    "model": "deepseek-v3",
    "max_tokens": 512,
    "temperature": 0.3,
    "timeout_ms": 5000,
    "fallback_model": "qwen-turbo"
  }'::jsonb,

  -- 元数据
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,                              -- 创建者 (userId 或 'system')

  -- 约束
  CONSTRAINT valid_scenario_weights CHECK (
    scenario_weights ? 'cold_start' AND
    scenario_weights ? 'learning' AND
    scenario_weights ? 'mature'
  ),
  CONSTRAINT valid_thresholds CHECK (
    thresholds ? 'direct_lock' AND
    thresholds ? 'high_confidence' AND
    thresholds ? 'medium_confidence'
  )
);

-- 2. 创建索引
CREATE INDEX idx_strategy_config_key ON classification_strategy_config(config_key);
CREATE INDEX idx_strategy_config_active ON classification_strategy_config(is_active) WHERE is_active = true;

-- 3. 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_strategy_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_strategy_config_updated_at
  BEFORE UPDATE ON classification_strategy_config
  FOR EACH ROW
  EXECUTE FUNCTION update_strategy_config_updated_at();

-- 4. 插入默认配置
INSERT INTO classification_strategy_config (
  config_key,
  version,
  description,
  created_by
) VALUES (
  'default',
  'v4.0',
  'V4.0 默认分类策略配置',
  'system'
);

-- 5. 创建配置变更审计表
CREATE TABLE IF NOT EXISTS classification_config_audit (
  id SERIAL PRIMARY KEY,
  config_key TEXT NOT NULL,
  action TEXT NOT NULL,                         -- 'create', 'update', 'delete'
  old_value JSONB,                              -- 变更前的值
  new_value JSONB,                              -- 变更后的值
  changed_fields TEXT[],                        -- 变更的字段列表
  changed_by TEXT,                              -- 操作者
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT                                   -- 变更原因
);

CREATE INDEX idx_config_audit_key ON classification_config_audit(config_key);
CREATE INDEX idx_config_audit_time ON classification_config_audit(changed_at DESC);

-- 6. 创建配置变更触发器
CREATE OR REPLACE FUNCTION log_strategy_config_changes()
RETURNS TRIGGER AS $$
DECLARE
  changed TEXT[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO classification_config_audit (config_key, action, new_value, changed_by)
    VALUES (NEW.config_key, 'create', row_to_json(NEW)::jsonb, NEW.created_by);
  ELSIF TG_OP = 'UPDATE' THEN
    -- 检测哪些字段发生了变化
    changed := ARRAY[]::TEXT[];
    IF OLD.scenario_weights IS DISTINCT FROM NEW.scenario_weights THEN
      changed := array_append(changed, 'scenario_weights');
    END IF;
    IF OLD.thresholds IS DISTINCT FROM NEW.thresholds THEN
      changed := array_append(changed, 'thresholds');
    END IF;
    IF OLD.feature_flags IS DISTINCT FROM NEW.feature_flags THEN
      changed := array_append(changed, 'feature_flags');
    END IF;
    IF OLD.matcher_config IS DISTINCT FROM NEW.matcher_config THEN
      changed := array_append(changed, 'matcher_config');
    END IF;
    IF OLD.ai_config IS DISTINCT FROM NEW.ai_config THEN
      changed := array_append(changed, 'ai_config');
    END IF;

    IF array_length(changed, 1) > 0 THEN
      INSERT INTO classification_config_audit (
        config_key, action, old_value, new_value, changed_fields, changed_by
      ) VALUES (
        NEW.config_key, 'update', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, changed, NEW.created_by
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO classification_config_audit (config_key, action, old_value)
    VALUES (OLD.config_key, 'delete', row_to_json(OLD)::jsonb);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_strategy_config_audit
  AFTER INSERT OR UPDATE OR DELETE ON classification_strategy_config
  FOR EACH ROW
  EXECUTE FUNCTION log_strategy_config_changes();

-- 7. RLS 策略
ALTER TABLE classification_strategy_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_config_audit ENABLE ROW LEVEL SECURITY;

-- 已认证用户可读取配置
CREATE POLICY "strategy_config_select_policy" ON classification_strategy_config
  FOR SELECT
  TO authenticated
  USING (true);

-- 管理员可写 (通过 service_role)

-- 审计表只读
CREATE POLICY "config_audit_select_policy" ON classification_config_audit
  FOR SELECT
  TO authenticated
  USING (true);

-- 8. 添加注释
COMMENT ON TABLE classification_strategy_config IS 'V4.0 分类策略配置表，支持场景化权重和热更新';
COMMENT ON TABLE classification_config_audit IS '配置变更审计日志';
COMMENT ON COLUMN classification_strategy_config.scenario_weights IS '场景化权重配置 (cold_start/learning/mature)';
COMMENT ON COLUMN classification_strategy_config.thresholds IS '全局阈值配置';
COMMENT ON COLUMN classification_strategy_config.feature_flags IS '功能开关';

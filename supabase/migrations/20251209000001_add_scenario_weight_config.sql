-- ================================================
-- V4.0 场景化权重配置表
-- 存储不同用户场景的最优匹配器权重
-- ================================================

-- 1. 创建场景权重配置表
CREATE TABLE IF NOT EXISTS public.scenario_weight_configs (
  id SERIAL PRIMARY KEY,

  -- 场景标识
  scenario VARCHAR(20) NOT NULL UNIQUE CHECK (scenario IN (
    'cold_start',   -- 新手期：书签 < 50, 文件夹 < 5
    'learning',     -- 学习期：书签 50-200, 有反馈记录
    'mature'        -- 成熟期：书签 > 200, 采纳率 > 90%
  )),

  -- 场景描述
  description TEXT,

  -- 匹配器权重配置 (JSONB 便于扩展)
  weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 结构示例:
  -- {
  --   "vector": 0.35,
  --   "history": 0.20,
  --   "ai": 0.25,
  --   "universal": 0.10,
  --   "tag": 0.05,
  --   "fingerprint": 0.05,
  --   "queryExpansion": 0.00
  -- }

  -- 阈值配置
  thresholds JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 结构示例:
  -- {
  --   "highConfidence": 80,
  --   "mediumConfidence": 60,
  --   "autoCreate": 50,
  --   "knnDirect": 0.85
  -- }

  -- A/B 测试配置
  ab_test_variant VARCHAR(20) DEFAULT 'control',
  ab_test_enabled BOOLEAN DEFAULT FALSE,

  -- 是否启用
  is_active BOOLEAN DEFAULT TRUE,

  -- 优先级（用于多配置冲突时）
  priority INTEGER DEFAULT 0,

  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_scenario_weight_configs_scenario
  ON public.scenario_weight_configs(scenario);

CREATE INDEX IF NOT EXISTS idx_scenario_weight_configs_active
  ON public.scenario_weight_configs(is_active, priority DESC);

-- 3. 插入默认场景配置

-- cold_start: 新手期配置
INSERT INTO public.scenario_weight_configs (scenario, description, weights, thresholds)
VALUES (
  'cold_start',
  '新手期：侧重通用分类和向量匹配，AI 介入频率较高',
  '{
    "vector": 0.40,
    "history": 0.05,
    "ai": 0.30,
    "universal": 0.15,
    "tag": 0.05,
    "fingerprint": 0.03,
    "queryExpansion": 0.02
  }'::jsonb,
  '{
    "highConfidence": 85,
    "mediumConfidence": 60,
    "autoCreate": 55,
    "knnDirect": 0.90
  }'::jsonb
) ON CONFLICT (scenario) DO UPDATE SET
  weights = EXCLUDED.weights,
  thresholds = EXCLUDED.thresholds,
  updated_at = NOW();

-- learning: 学习期配置
INSERT INTO public.scenario_weight_configs (scenario, description, weights, thresholds)
VALUES (
  'learning',
  '学习期：均衡配置，历史行为权重提升，开始个性化',
  '{
    "vector": 0.30,
    "history": 0.25,
    "ai": 0.20,
    "universal": 0.10,
    "tag": 0.08,
    "fingerprint": 0.05,
    "queryExpansion": 0.02
  }'::jsonb,
  '{
    "highConfidence": 80,
    "mediumConfidence": 60,
    "autoCreate": 50,
    "knnDirect": 0.85
  }'::jsonb
) ON CONFLICT (scenario) DO UPDATE SET
  weights = EXCLUDED.weights,
  thresholds = EXCLUDED.thresholds,
  updated_at = NOW();

-- mature: 成熟期配置
INSERT INTO public.scenario_weight_configs (scenario, description, weights, thresholds)
VALUES (
  'mature',
  '成熟期：侧重历史行为和指纹匹配，减少 AI 调用',
  '{
    "vector": 0.20,
    "history": 0.35,
    "ai": 0.10,
    "universal": 0.05,
    "tag": 0.10,
    "fingerprint": 0.15,
    "queryExpansion": 0.05
  }'::jsonb,
  '{
    "highConfidence": 75,
    "mediumConfidence": 55,
    "autoCreate": 45,
    "knnDirect": 0.80
  }'::jsonb
) ON CONFLICT (scenario) DO UPDATE SET
  weights = EXCLUDED.weights,
  thresholds = EXCLUDED.thresholds,
  updated_at = NOW();

-- 4. 创建 A/B 测试记录表
CREATE TABLE IF NOT EXISTS public.ab_test_assignments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 测试标识
  test_name VARCHAR(50) NOT NULL,

  -- 分配的变体
  variant VARCHAR(20) NOT NULL,

  -- 分配时间
  assigned_at TIMESTAMPTZ DEFAULT NOW(),

  -- 过期时间
  expires_at TIMESTAMPTZ,

  -- 唯一约束：每个用户每个测试只能有一个分配
  CONSTRAINT unique_user_test UNIQUE (user_id, test_name)
);

-- 5. 创建索引
CREATE INDEX IF NOT EXISTS idx_ab_test_assignments_user
  ON public.ab_test_assignments(user_id);

CREATE INDEX IF NOT EXISTS idx_ab_test_assignments_test
  ON public.ab_test_assignments(test_name, variant);

-- 6. 启用 RLS
ALTER TABLE public.scenario_weight_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_test_assignments ENABLE ROW LEVEL SECURITY;

-- 场景配置：所有认证用户可读
CREATE POLICY "Authenticated users can view scenario configs"
  ON public.scenario_weight_configs
  FOR SELECT
  TO authenticated
  USING (true);

-- A/B 测试分配：用户只能查看自己的分配
CREATE POLICY "Users can view own AB test assignments"
  ON public.ab_test_assignments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- A/B 测试分配：系统可以创建分配（通过 service role）
CREATE POLICY "System can create AB test assignments"
  ON public.ab_test_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 7. 添加注释
COMMENT ON TABLE public.scenario_weight_configs IS 'V4.0 场景化权重配置表：存储不同用户场景的最优匹配器权重';
COMMENT ON COLUMN public.scenario_weight_configs.scenario IS '场景标识：cold_start/learning/mature';
COMMENT ON COLUMN public.scenario_weight_configs.weights IS '匹配器权重配置 (JSONB)';
COMMENT ON COLUMN public.scenario_weight_configs.thresholds IS '置信度阈值配置 (JSONB)';
COMMENT ON COLUMN public.scenario_weight_configs.ab_test_variant IS 'A/B 测试变体标识';

COMMENT ON TABLE public.ab_test_assignments IS 'A/B 测试用户分配表';
COMMENT ON COLUMN public.ab_test_assignments.test_name IS '测试名称';
COMMENT ON COLUMN public.ab_test_assignments.variant IS '分配的变体 (control/treatment)';

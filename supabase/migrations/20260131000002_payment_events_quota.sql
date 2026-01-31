-- ============================================
-- Payment System - Part 2: Events & Quota
-- ============================================

-- 1. Webhook 事件表 (幂等性保障)
CREATE TABLE payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 事件标识
  provider TEXT NOT NULL,                  -- 'lemonsqueezy', 'yungouos'
  event_id TEXT NOT NULL,                  -- 第三方 Webhook 事件 ID
  event_type TEXT NOT NULL,                -- 事件类型

  -- 处理状态
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- 原始数据
  payload JSONB NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now(),

  -- 幂等性保障：同一事件只处理一次
  UNIQUE(provider, event_id)
);

-- 索引
CREATE INDEX idx_payment_events_processed ON payment_events(processed) WHERE processed = false;
CREATE INDEX idx_payment_events_created ON payment_events(created_at DESC);

-- 2. 用户配额使用表
CREATE TABLE user_quota_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 时间周期
  month TEXT NOT NULL,                     -- '2026-01'

  -- 使用量
  ai_calls_used INTEGER DEFAULT 0,
  ai_calls_today INTEGER DEFAULT 0,        -- 当日已用（熔断检查）
  last_call_date DATE,                     -- 最后调用日期（用于重置 ai_calls_today）
  storage_used_mb NUMERIC(10,2) DEFAULT 0,
  bookmarks_count INTEGER DEFAULT 0,
  tts_seconds_used INTEGER DEFAULT 0,      -- TTS 使用秒数
  synthesis_count INTEGER DEFAULT 0,       -- 主题合成使用次数

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id, month)
);

-- 索引
CREATE INDEX idx_user_quota_usage_user_month ON user_quota_usage(user_id, month);

-- 3. 用户权益表（权限快照，高性能查询）
CREATE TABLE user_entitlements (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 套餐信息
  plan_tier TEXT NOT NULL DEFAULT 'free',  -- 'free', 'pro', 'pro_plus', 'lifetime'
  valid_until TIMESTAMPTZ,                  -- 会员过期时间 (lifetime 为 NULL 或 2099-12-31)

  -- 配额限制
  ai_quota_monthly INTEGER DEFAULT 20,      -- 月配额
  ai_quota_daily_limit INTEGER DEFAULT 50,  -- 单日熔断阈值（防脚本）
  storage_limit_mb INTEGER DEFAULT 100,
  tts_seconds_monthly INTEGER DEFAULT 0,    -- TTS 月配额（秒）

  -- 特殊标记
  is_lifetime BOOLEAN DEFAULT FALSE,        -- 终身用户标记

  -- 试用期信息
  trial_started_at TIMESTAMPTZ,             -- 试用开始时间
  trial_ends_at TIMESTAMPTZ,                -- 试用结束时间
  trial_used BOOLEAN DEFAULT FALSE,         -- 是否已使用试用
  trial_converted BOOLEAN DEFAULT FALSE,    -- 是否转化为付费

  -- 退款追踪（防薅羊毛）
  refund_count INTEGER DEFAULT 0,           -- 退款次数
  last_refunded_at TIMESTAMPTZ,             -- 最后退款时间
  refund_reason TEXT,                       -- 退款原因

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 权益表索引
CREATE INDEX idx_user_entitlements_valid ON user_entitlements(valid_until) WHERE valid_until IS NOT NULL;
CREATE INDEX idx_user_entitlements_tier ON user_entitlements(plan_tier);
CREATE INDEX idx_user_entitlements_trial ON user_entitlements(trial_ends_at)
  WHERE trial_ends_at IS NOT NULL AND plan_tier = 'pro';

-- RLS
ALTER TABLE user_quota_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quota" ON user_quota_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own entitlements" ON user_entitlements
  FOR SELECT USING (auth.uid() = user_id);

-- 触发器
CREATE TRIGGER update_user_quota_usage_updated_at
  BEFORE UPDATE ON user_quota_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_entitlements_updated_at
  BEFORE UPDATE ON user_entitlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

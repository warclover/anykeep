-- ============================================
-- Payment System - Part 1: Subscription Plans
-- ============================================

-- 1. 订阅计划表
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                      -- 'free', 'pro', 'pro_plus', 'lifetime'
  display_name TEXT NOT NULL,              -- '免费版', 'Pro', 'Pro+'
  price_cny INTEGER NOT NULL,              -- 价格（分）
  price_usd INTEGER NOT NULL,              -- 美元价格（分）
  interval TEXT NOT NULL DEFAULT 'year',   -- 'month', 'year', 'lifetime'
  interval_count INTEGER DEFAULT 1,        -- 间隔数量
  ai_quota INTEGER NOT NULL,               -- AI 调用配额/月 (-1 表示无限)
  storage_quota_mb INTEGER NOT NULL,       -- 存储配额 (MB)
  features JSONB NOT NULL DEFAULT '[]',    -- 功能列表
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX idx_subscription_plans_active ON subscription_plans(is_active, sort_order);

-- 初始化计划数据
INSERT INTO subscription_plans (name, display_name, price_cny, price_usd, interval, ai_quota, storage_quota_mb, features, sort_order) VALUES
('free', '免费版', 0, 0, 'year', 20, 100, '["500条收藏", "AI功能20次/月", "100MB快照存储"]'::jsonb, 0),
('pro', 'Pro', 9900, 1499, 'year', 500, 5120, '["5000条收藏", "AI功能500次/月", "5GB快照存储", "主题合成器", "知识工作室", "TTS语音"]'::jsonb, 1),
('pro_plus', 'Pro+', 19900, 2999, 'year', 3000, 20480, '["无限收藏", "AI功能3000次/月", "20GB快照存储", "全部功能解锁", "优先客服"]'::jsonb, 2),
('lifetime', '终身版', 49900, 6999, 'lifetime', 500, 20480, '["终身有效", "AI功能500次/月", "20GB快照存储", "全部功能解锁"]'::jsonb, 3);

-- 2. 用户订阅表
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id),

  -- 状态管理
  status TEXT NOT NULL DEFAULT 'active',   -- 'active', 'canceled', 'expired', 'past_due', 'refunded', 'trialing'

  -- 支付渠道信息
  payment_provider TEXT NOT NULL,          -- 'lemonsqueezy', 'yungouos'
  provider_subscription_id TEXT,           -- 第三方订阅 ID
  provider_customer_id TEXT,               -- 第三方客户 ID

  -- 时间管理
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,                   -- 试用期结束时间
  grace_period_end TIMESTAMPTZ,            -- 宽限期结束时间 (过期后7天内仍可访问)

  -- 取消管理
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  cancellation_reason TEXT,                -- 取消原因

  -- 元数据
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id)
);

-- 索引优化
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_period_end ON user_subscriptions(current_period_end);
CREATE INDEX idx_user_subscriptions_provider ON user_subscriptions(payment_provider, provider_subscription_id);

-- 3. 支付记录表
CREATE TABLE payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  subscription_id UUID REFERENCES user_subscriptions(id),

  -- 支付信息
  payment_provider TEXT NOT NULL,
  provider_payment_id TEXT NOT NULL,
  amount INTEGER NOT NULL,                 -- 金额（分）
  currency TEXT NOT NULL,                  -- 'CNY', 'USD'

  -- 状态
  status TEXT NOT NULL,                    -- 'pending', 'succeeded', 'failed', 'refunded', 'partially_refunded'
  refund_amount INTEGER DEFAULT 0,         -- 退款金额（分）
  refund_reason TEXT,

  -- 支付方式
  payment_method TEXT,                     -- 'wechat', 'alipay', 'card', 'paypal'

  -- 元数据
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(payment_provider, provider_payment_id)
);

-- 索引
CREATE INDEX idx_payment_records_user ON payment_records(user_id, created_at DESC);
CREATE INDEX idx_payment_records_status ON payment_records(status);

-- RLS 策略
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own payments" ON payment_records
  FOR SELECT USING (auth.uid() = user_id);

-- 自动更新 updated_at 触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

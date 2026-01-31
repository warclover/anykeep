-- ============================================
-- Payment System - Part 3: Orders & Functions
-- ============================================

-- 1. 订单表 (国内支付专用)
CREATE TABLE payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 订单信息
  order_no TEXT NOT NULL UNIQUE,           -- 商户订单号
  user_id UUID REFERENCES auth.users(id),
  plan_id UUID REFERENCES subscription_plans(id),

  -- 金额
  amount INTEGER NOT NULL,                 -- 金额（分）
  currency TEXT NOT NULL DEFAULT 'CNY',

  -- 状态
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'paid', 'expired', 'refunded'

  -- 支付信息
  payment_provider TEXT NOT NULL,
  payment_method TEXT,                     -- 实际支付方式
  paid_at TIMESTAMPTZ,

  -- 过期时间 (30分钟)
  expires_at TIMESTAMPTZ NOT NULL,

  -- 元数据
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX idx_payment_orders_user ON payment_orders(user_id, created_at DESC);
CREATE INDEX idx_payment_orders_status ON payment_orders(status) WHERE status = 'pending';
CREATE INDEX idx_payment_orders_expires ON payment_orders(expires_at) WHERE status = 'pending';

-- RLS
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders" ON payment_orders
  FOR SELECT USING (auth.uid() = user_id);

-- 2. 配额增量更新函数
CREATE OR REPLACE FUNCTION increment_quota_usage(
  p_user_id UUID,
  p_month TEXT,
  p_field TEXT,
  p_amount NUMERIC
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_quota_usage (user_id, month, ai_calls_used, storage_used_mb, tts_seconds_used, synthesis_count)
  VALUES (p_user_id, p_month,
    CASE WHEN p_field = 'ai_calls_used' THEN p_amount::INTEGER ELSE 0 END,
    CASE WHEN p_field = 'storage_used_mb' THEN p_amount ELSE 0 END,
    CASE WHEN p_field = 'tts_seconds_used' THEN p_amount::INTEGER ELSE 0 END,
    CASE WHEN p_field = 'synthesis_count' THEN p_amount::INTEGER ELSE 0 END
  )
  ON CONFLICT (user_id, month)
  DO UPDATE SET
    ai_calls_used = CASE
      WHEN p_field = 'ai_calls_used'
      THEN user_quota_usage.ai_calls_used + p_amount::INTEGER
      ELSE user_quota_usage.ai_calls_used
    END,
    storage_used_mb = CASE
      WHEN p_field = 'storage_used_mb'
      THEN user_quota_usage.storage_used_mb + p_amount
      ELSE user_quota_usage.storage_used_mb
    END,
    tts_seconds_used = CASE
      WHEN p_field = 'tts_seconds_used'
      THEN user_quota_usage.tts_seconds_used + p_amount::INTEGER
      ELSE user_quota_usage.tts_seconds_used
    END,
    synthesis_count = CASE
      WHEN p_field = 'synthesis_count'
      THEN user_quota_usage.synthesis_count + p_amount::INTEGER
      ELSE user_quota_usage.synthesis_count
    END,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 每日配额重置函数（用于 ai_calls_today 熔断检查）
CREATE OR REPLACE FUNCTION reset_daily_quota_if_needed(
  p_user_id UUID,
  p_month TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_last_date DATE;
  v_calls_today INTEGER;
BEGIN
  SELECT last_call_date, ai_calls_today INTO v_last_date, v_calls_today
  FROM user_quota_usage
  WHERE user_id = p_user_id AND month = p_month;

  IF v_last_date IS NULL OR v_last_date < v_today THEN
    UPDATE user_quota_usage
    SET ai_calls_today = 0, last_call_date = v_today
    WHERE user_id = p_user_id AND month = p_month;
    RETURN 0;
  END IF;

  RETURN COALESCE(v_calls_today, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 增加每日调用计数函数
CREATE OR REPLACE FUNCTION increment_daily_ai_calls(
  p_user_id UUID,
  p_month TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_calls_today INTEGER;
BEGIN
  -- 先重置（如果是新的一天）
  PERFORM reset_daily_quota_if_needed(p_user_id, p_month);

  -- 增加计数
  UPDATE user_quota_usage
  SET ai_calls_today = ai_calls_today + 1, last_call_date = CURRENT_DATE
  WHERE user_id = p_user_id AND month = p_month
  RETURNING ai_calls_today INTO v_calls_today;

  RETURN COALESCE(v_calls_today, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 获取用户权益函数（高性能）
CREATE OR REPLACE FUNCTION get_user_entitlement(p_user_id UUID)
RETURNS TABLE (
  plan_tier TEXT,
  ai_quota_monthly INTEGER,
  ai_quota_daily_limit INTEGER,
  storage_limit_mb INTEGER,
  is_lifetime BOOLEAN,
  valid_until TIMESTAMPTZ,
  is_trial BOOLEAN,
  trial_ends_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.plan_tier,
    e.ai_quota_monthly,
    e.ai_quota_daily_limit,
    e.storage_limit_mb,
    e.is_lifetime,
    e.valid_until,
    (e.trial_ends_at IS NOT NULL AND e.trial_ends_at > now()) AS is_trial,
    e.trial_ends_at
  FROM user_entitlements e
  WHERE e.user_id = p_user_id;

  -- 如果没有记录，返回免费用户默认值
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      'free'::TEXT,
      20::INTEGER,
      50::INTEGER,
      100::INTEGER,
      FALSE::BOOLEAN,
      NULL::TIMESTAMPTZ,
      FALSE::BOOLEAN,
      NULL::TIMESTAMPTZ;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 订单号生成函数
CREATE OR REPLACE FUNCTION generate_order_no()
RETURNS TEXT AS $$
DECLARE
  v_timestamp TEXT;
  v_random TEXT;
BEGIN
  v_timestamp := to_char(now() AT TIME ZONE 'Asia/Shanghai', 'YYYYMMDDHH24MISS');
  v_random := lpad(floor(random() * 1000000)::TEXT, 6, '0');
  RETURN 'AK' || v_timestamp || v_random;
END;
$$ LANGUAGE plpgsql;

-- 7. 自动创建用户权益记录（新用户注册时）
CREATE OR REPLACE FUNCTION create_default_entitlement()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_entitlements (user_id, plan_tier, ai_quota_monthly, storage_limit_mb)
  VALUES (NEW.id, 'free', 20, 100)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 注意：此触发器需要在 auth.users 表上创建，可能需要额外权限
-- 如果无法直接创建，可以在应用层处理
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION create_default_entitlement();

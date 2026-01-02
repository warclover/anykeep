-- Knowledge Studio P4: Conversion & Trial Tables
-- 7天转化窗口表
-- 2026-01-02

-- ============================================================================
-- 用户试用状态表
-- ============================================================================

CREATE TABLE IF NOT EXISTS ks_user_trial_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'converted', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  generations_used INTEGER NOT NULL DEFAULT 0,
  features_experienced TEXT[] NOT NULL DEFAULT '{}',
  conversion_stage TEXT NOT NULL DEFAULT 'awareness' CHECK (
    conversion_stage IN ('awareness', 'activation', 'engagement', 'consideration', 'conversion', 'retention')
  ),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_ks_trial_states_user_id ON ks_user_trial_states(user_id);
CREATE INDEX idx_ks_trial_states_status ON ks_user_trial_states(status);
CREATE INDEX idx_ks_trial_states_expires_at ON ks_user_trial_states(expires_at);
CREATE INDEX idx_ks_trial_states_stage ON ks_user_trial_states(conversion_stage);

-- RLS
ALTER TABLE ks_user_trial_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trial state"
  ON ks_user_trial_states FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own trial state"
  ON ks_user_trial_states FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage trial states"
  ON ks_user_trial_states FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- 转化事件表
-- ============================================================================

CREATE TABLE IF NOT EXISTS ks_conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (
    trigger_type IN ('quota_exhausted', 'feature_locked', 'trial_ending', 'trial_expired', 'manual_upgrade', 'promo_offer')
  ),
  source_page TEXT,
  feature_id TEXT,
  remaining_days INTEGER,
  remaining_quota INTEGER,
  user_response TEXT CHECK (user_response IN ('dismissed', 'clicked', 'converted', 'delayed')),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_ks_conversion_events_user_id ON ks_conversion_events(user_id);
CREATE INDEX idx_ks_conversion_events_trigger ON ks_conversion_events(trigger_type);
CREATE INDEX idx_ks_conversion_events_created_at ON ks_conversion_events(created_at);
CREATE INDEX idx_ks_conversion_events_response ON ks_conversion_events(user_response);

-- RLS
ALTER TABLE ks_conversion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversion events"
  ON ks_conversion_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert conversion events"
  ON ks_conversion_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversion events"
  ON ks_conversion_events FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 升级提示记录表
-- ============================================================================

CREATE TABLE IF NOT EXISTS ks_upgrade_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_type TEXT NOT NULL CHECK (prompt_type IN ('modal', 'banner', 'inline', 'tooltip')),
  trigger_type TEXT NOT NULL,
  shown_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  response TEXT CHECK (response IN ('dismissed', 'clicked', 'converted', 'delayed')),
  responded_at TIMESTAMPTZ,
  cooldown_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_ks_upgrade_prompts_user_id ON ks_upgrade_prompts(user_id);
CREATE INDEX idx_ks_upgrade_prompts_type ON ks_upgrade_prompts(prompt_type);
CREATE INDEX idx_ks_upgrade_prompts_cooldown ON ks_upgrade_prompts(cooldown_until);

-- RLS
ALTER TABLE ks_upgrade_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own upgrade prompts"
  ON ks_upgrade_prompts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage upgrade prompts"
  ON ks_upgrade_prompts FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- 折扣优惠表
-- ============================================================================

CREATE TABLE IF NOT EXISTS ks_discount_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_type TEXT NOT NULL CHECK (offer_type IN ('trial_ending', 'trial_expired', 'win_back', 'loyalty', 'referral')),
  discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ NOT NULL,
  redeemed_at TIMESTAMPTZ,
  promo_code TEXT UNIQUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_ks_discount_offers_user_id ON ks_discount_offers(user_id);
CREATE INDEX idx_ks_discount_offers_type ON ks_discount_offers(offer_type);
CREATE INDEX idx_ks_discount_offers_valid_until ON ks_discount_offers(valid_until);
CREATE INDEX idx_ks_discount_offers_promo_code ON ks_discount_offers(promo_code);

-- RLS
ALTER TABLE ks_discount_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own discount offers"
  ON ks_discount_offers FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- 邮件提醒记录表
-- ============================================================================

CREATE TABLE IF NOT EXISTS ks_email_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (
    reminder_type IN ('trial_ending_3days', 'trial_ending_1day', 'trial_expired', 'discount_offer', 'win_back')
  ),
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  email_id TEXT, -- 邮件服务商返回的 ID
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_ks_email_reminders_user_id ON ks_email_reminders(user_id);
CREATE INDEX idx_ks_email_reminders_type ON ks_email_reminders(reminder_type);
CREATE INDEX idx_ks_email_reminders_scheduled ON ks_email_reminders(scheduled_at);
CREATE INDEX idx_ks_email_reminders_sent ON ks_email_reminders(sent_at);

-- RLS
ALTER TABLE ks_email_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email reminders"
  ON ks_email_reminders FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- RPC 函数
-- ============================================================================

-- 开始试用
CREATE OR REPLACE FUNCTION start_user_trial(
  p_user_id UUID,
  p_duration_days INTEGER DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- 验证用户
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_expires_at := now() + (p_duration_days || ' days')::INTERVAL;

  -- 插入或更新试用状态
  INSERT INTO ks_user_trial_states (
    user_id, status, started_at, expires_at, conversion_stage, last_active_at
  ) VALUES (
    p_user_id, 'active', now(), v_expires_at, 'awareness', now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'active',
    started_at = now(),
    expires_at = v_expires_at,
    generations_used = 0,
    features_experienced = '{}',
    conversion_stage = 'awareness',
    last_active_at = now(),
    updated_at = now()
  RETURNING jsonb_build_object(
    'userId', user_id,
    'status', status,
    'startedAt', started_at,
    'expiresAt', expires_at,
    'generationsUsed', generations_used,
    'featuresExperienced', features_experienced,
    'conversionStage', conversion_stage,
    'lastActiveAt', last_active_at
  ) INTO v_result;

  -- 创建试用结束提醒（3天和1天）
  INSERT INTO ks_email_reminders (user_id, reminder_type, scheduled_at)
  VALUES
    (p_user_id, 'trial_ending_3days', v_expires_at - INTERVAL '3 days'),
    (p_user_id, 'trial_ending_1day', v_expires_at - INTERVAL '1 day'),
    (p_user_id, 'trial_expired', v_expires_at);

  RETURN v_result;
END;
$$;

-- 获取即将过期的试用用户
CREATE OR REPLACE FUNCTION get_expiring_trials(
  p_within_days INTEGER DEFAULT 3
)
RETURNS SETOF ks_user_trial_states
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM ks_user_trial_states
  WHERE status = 'active'
    AND expires_at > now()
    AND expires_at <= now() + (p_within_days || ' days')::INTERVAL
  ORDER BY expires_at ASC;
END;
$$;

-- 获取转化漏斗指标
CREATE OR REPLACE FUNCTION get_conversion_funnel_metrics(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_stage_counts JSONB;
  v_trigger_counts JSONB;
  v_total_trials INTEGER;
  v_total_converted INTEGER;
BEGIN
  -- 统计各阶段用户数
  SELECT jsonb_object_agg(conversion_stage, cnt)
  FROM (
    SELECT conversion_stage, COUNT(*) as cnt
    FROM ks_user_trial_states
    WHERE created_at >= p_start_date AND created_at <= p_end_date
    GROUP BY conversion_stage
  ) t INTO v_stage_counts;

  -- 统计触发类型分布
  SELECT jsonb_object_agg(trigger_type, cnt)
  FROM (
    SELECT trigger_type, COUNT(*) as cnt
    FROM ks_conversion_events
    WHERE created_at >= p_start_date AND created_at <= p_end_date
    GROUP BY trigger_type
  ) t INTO v_trigger_counts;

  -- 总体转化率
  SELECT COUNT(*) INTO v_total_trials
  FROM ks_user_trial_states
  WHERE created_at >= p_start_date AND created_at <= p_end_date;

  SELECT COUNT(*) INTO v_total_converted
  FROM ks_user_trial_states
  WHERE created_at >= p_start_date AND created_at <= p_end_date
    AND status = 'converted';

  v_result := jsonb_build_object(
    'period', jsonb_build_object('start', p_start_date, 'end', p_end_date),
    'stageCounts', COALESCE(v_stage_counts, '{}'::JSONB),
    'triggerDistribution', COALESCE(v_trigger_counts, '{}'::JSONB),
    'totalTrials', v_total_trials,
    'totalConverted', v_total_converted,
    'overallConversionRate', CASE WHEN v_total_trials > 0
      THEN ROUND((v_total_converted::NUMERIC / v_total_trials) * 100, 2)
      ELSE 0 END,
    'averageConversionDays', COALESCE(
      (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (converted_at - started_at)) / 86400), 1)
       FROM ks_user_trial_states
       WHERE created_at >= p_start_date AND created_at <= p_end_date
         AND status = 'converted'),
      0
    )
  );

  RETURN v_result;
END;
$$;

-- 检查并创建折扣优惠
CREATE OR REPLACE FUNCTION create_trial_discount_offer(
  p_user_id UUID,
  p_offer_type TEXT,
  p_discount_percent INTEGER DEFAULT 20,
  p_valid_days INTEGER DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_promo_code TEXT;
BEGIN
  -- 验证用户
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 检查是否已有有效优惠
  IF EXISTS (
    SELECT 1 FROM ks_discount_offers
    WHERE user_id = p_user_id
      AND valid_until > now()
      AND redeemed_at IS NULL
  ) THEN
    SELECT jsonb_build_object(
      'success', false,
      'message', 'User already has an active discount offer'
    ) INTO v_result;
    RETURN v_result;
  END IF;

  -- 生成优惠码
  v_promo_code := 'KS' || UPPER(SUBSTRING(MD5(p_user_id::TEXT || now()::TEXT) FROM 1 FOR 8));

  -- 创建优惠
  INSERT INTO ks_discount_offers (
    user_id, offer_type, discount_percent, valid_from, valid_until, promo_code
  ) VALUES (
    p_user_id, p_offer_type, p_discount_percent, now(), now() + (p_valid_days || ' days')::INTERVAL, v_promo_code
  )
  RETURNING jsonb_build_object(
    'success', true,
    'offerId', id,
    'promoCode', promo_code,
    'discountPercent', discount_percent,
    'validUntil', valid_until
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 更新试用状态（检查过期）
CREATE OR REPLACE FUNCTION update_trial_status()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE ks_user_trial_states
  SET status = 'expired', updated_at = now()
  WHERE status = 'active'
    AND expires_at < now();

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

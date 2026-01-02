-- Knowledge Studio P3: Billing & Usage Tables
-- 账单与使用统计表
-- 2026-01-02

-- ============================================================================
-- 使用量记录表
-- ============================================================================

CREATE TABLE IF NOT EXISTS ks_usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_type TEXT NOT NULL CHECK (usage_type IN ('generation', 'chat_edit', 'ai_recommendation', 'export', 'storage')),
  amount INTEGER NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'count',
  resource_id UUID, -- 关联的报告/书签 ID
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_ks_usage_records_user_id ON ks_usage_records(user_id);
CREATE INDEX idx_ks_usage_records_type ON ks_usage_records(usage_type);
CREATE INDEX idx_ks_usage_records_created_at ON ks_usage_records(created_at);
CREATE INDEX idx_ks_usage_records_user_type_date ON ks_usage_records(user_id, usage_type, created_at);

-- RLS
ALTER TABLE ks_usage_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage records"
  ON ks_usage_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert usage records"
  ON ks_usage_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 账单表
-- ============================================================================

CREATE TABLE IF NOT EXISTS ks_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  subtotal INTEGER NOT NULL DEFAULT 0, -- 分
  discount INTEGER NOT NULL DEFAULT 0, -- 分
  tax INTEGER NOT NULL DEFAULT 0, -- 分
  total INTEGER NOT NULL DEFAULT 0, -- 分
  currency TEXT NOT NULL DEFAULT 'CNY',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'refunded')),
  due_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_ks_bills_user_id ON ks_bills(user_id);
CREATE INDEX idx_ks_bills_status ON ks_bills(status);
CREATE INDEX idx_ks_bills_due_at ON ks_bills(due_at);

-- RLS
ALTER TABLE ks_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bills"
  ON ks_bills FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- 账单项目表
-- ============================================================================

CREATE TABLE IF NOT EXISTS ks_bill_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES ks_bills(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  usage_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0, -- 分
  total_price INTEGER NOT NULL DEFAULT 0, -- 分
  discount INTEGER NOT NULL DEFAULT 0, -- 分
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_ks_bill_line_items_bill_id ON ks_bill_line_items(bill_id);

-- RLS
ALTER TABLE ks_bill_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bill items"
  ON ks_bill_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ks_bills
      WHERE ks_bills.id = ks_bill_line_items.bill_id
      AND ks_bills.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 消费记录表
-- ============================================================================

CREATE TABLE IF NOT EXISTS ks_consumption_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_type TEXT NOT NULL,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 1,
  cost INTEGER NOT NULL DEFAULT 0, -- 分
  report_id UUID, -- 关联报告
  blueprint_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_ks_consumption_records_user_id ON ks_consumption_records(user_id);
CREATE INDEX idx_ks_consumption_records_type ON ks_consumption_records(usage_type);
CREATE INDEX idx_ks_consumption_records_created_at ON ks_consumption_records(created_at);

-- RLS
ALTER TABLE ks_consumption_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own consumption records"
  ON ks_consumption_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert consumption records"
  ON ks_consumption_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 使用量统计 RPC
-- ============================================================================

-- 获取用户使用统计
CREATE OR REPLACE FUNCTION get_user_usage_stats(
  p_user_id UUID,
  p_period TEXT DEFAULT 'monthly',
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  -- 验证用户
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 计算时间范围
  v_end := COALESCE(p_end_date, now());
  v_start := COALESCE(p_start_date,
    CASE p_period
      WHEN 'daily' THEN v_end - INTERVAL '1 day'
      WHEN 'weekly' THEN v_end - INTERVAL '7 days'
      WHEN 'monthly' THEN v_end - INTERVAL '30 days'
      WHEN 'yearly' THEN v_end - INTERVAL '365 days'
      ELSE v_end - INTERVAL '30 days'
    END
  );

  -- 聚合统计
  SELECT jsonb_build_object(
    'userId', p_user_id,
    'period', p_period,
    'periodStart', v_start,
    'periodEnd', v_end,
    'usageByType', COALESCE(
      (SELECT jsonb_object_agg(usage_type, total_amount)
       FROM (
         SELECT usage_type, SUM(amount) as total_amount
         FROM ks_usage_records
         WHERE user_id = p_user_id
           AND created_at >= v_start
           AND created_at <= v_end
         GROUP BY usage_type
       ) t
      ),
      '{}'::JSONB
    ),
    'totalUsage', COALESCE(
      (SELECT SUM(amount) FROM ks_usage_records
       WHERE user_id = p_user_id
         AND created_at >= v_start
         AND created_at <= v_end),
      0
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 获取消费汇总
CREATE OR REPLACE FUNCTION get_consumption_summary(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_prev_start TIMESTAMPTZ;
  v_prev_end TIMESTAMPTZ;
  v_current_total INTEGER;
  v_prev_total INTEGER;
BEGIN
  -- 验证用户
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 计算上期时间范围
  v_prev_end := p_start_date;
  v_prev_start := p_start_date - (p_end_date - p_start_date);

  -- 当期消费
  SELECT COALESCE(SUM(cost), 0) INTO v_current_total
  FROM ks_consumption_records
  WHERE user_id = p_user_id
    AND created_at >= p_start_date
    AND created_at <= p_end_date;

  -- 上期消费
  SELECT COALESCE(SUM(cost), 0) INTO v_prev_total
  FROM ks_consumption_records
  WHERE user_id = p_user_id
    AND created_at >= v_prev_start
    AND created_at < v_prev_end;

  -- 构建结果
  SELECT jsonb_build_object(
    'userId', p_user_id,
    'period', jsonb_build_object('start', p_start_date, 'end', p_end_date),
    'consumptionByType', COALESCE(
      (SELECT jsonb_object_agg(usage_type, jsonb_build_object('amount', total_amount, 'cost', total_cost))
       FROM (
         SELECT usage_type, SUM(amount) as total_amount, SUM(cost) as total_cost
         FROM ks_consumption_records
         WHERE user_id = p_user_id
           AND created_at >= p_start_date
           AND created_at <= p_end_date
         GROUP BY usage_type
       ) t
      ),
      '{}'::JSONB
    ),
    'totalAmount', (SELECT COALESCE(SUM(amount), 0) FROM ks_consumption_records WHERE user_id = p_user_id AND created_at >= p_start_date AND created_at <= p_end_date),
    'totalCost', v_current_total,
    'dailyAverage', CASE WHEN (p_end_date - p_start_date) > INTERVAL '0' THEN v_current_total / GREATEST(EXTRACT(EPOCH FROM (p_end_date - p_start_date)) / 86400, 1) ELSE 0 END,
    'trend', CASE
      WHEN v_prev_total = 0 THEN 'stable'
      WHEN v_current_total > v_prev_total THEN 'up'
      WHEN v_current_total < v_prev_total THEN 'down'
      ELSE 'stable'
    END,
    'trendPercent', CASE
      WHEN v_prev_total = 0 THEN 0
      ELSE ROUND(((v_current_total - v_prev_total)::NUMERIC / v_prev_total) * 100)
    END
  ) INTO v_result;

  RETURN v_result;
END;
$$;

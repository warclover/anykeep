-- =============================================================================
-- Migration: Token 使用记录表
-- Description: 持久化 AI Token 使用统计，支持成本控制和用量分析
-- Version: 1.0.0
-- Date: 2025-12-26
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 创建 Token 使用记录表
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.token_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 用户关联
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 请求信息
  request_id TEXT NOT NULL,

  -- 模型信息
  model TEXT NOT NULL,
  tier_id TEXT NOT NULL CHECK (tier_id IN ('fast', 'standard', 'deep')),

  -- Token 统计
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,

  -- 成本计算（相对值，用于预算控制）
  cost NUMERIC(10, 2) NOT NULL DEFAULT 0,

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. 创建索引
-- -----------------------------------------------------------------------------

-- 用户 + 时间索引（用于查询用户日/月使用量）
CREATE INDEX idx_token_usage_logs_user_time
  ON public.token_usage_logs (user_id, created_at DESC);

-- 时间范围索引（用于统计分析，替代 DATE() 函数索引）
-- 注意：DATE() 对 TIMESTAMPTZ 不是 IMMUTABLE，改用 created_at 直接索引
-- 日期范围查询仍可高效使用此索引
CREATE INDEX idx_token_usage_logs_created_at
  ON public.token_usage_logs (created_at);

-- 层级索引（用于层级分布分析）
CREATE INDEX idx_token_usage_logs_tier
  ON public.token_usage_logs (tier_id);

-- -----------------------------------------------------------------------------
-- 3. RLS 策略
-- -----------------------------------------------------------------------------

ALTER TABLE public.token_usage_logs ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的记录
CREATE POLICY "Users can view own token usage"
  ON public.token_usage_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- 用户可以插入自己的记录（通过 API）
CREATE POLICY "Users can insert own token usage"
  ON public.token_usage_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 禁止更新和删除（只读记录，用于审计）
-- 不创建 UPDATE 和 DELETE 策略，默认拒绝

-- -----------------------------------------------------------------------------
-- 4. 创建汇总查询函数（高效获取用户统计）
-- -----------------------------------------------------------------------------

-- 获取用户 Token 使用统计
CREATE OR REPLACE FUNCTION public.get_user_token_stats(
  p_user_id UUID,
  p_today_start TIMESTAMPTZ DEFAULT (CURRENT_DATE)::TIMESTAMPTZ,
  p_month_start TIMESTAMPTZ DEFAULT (DATE_TRUNC('month', CURRENT_DATE))::TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- 安全检查：只能查询自己的数据
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN json_build_object(
      'error', 'unauthorized',
      'message', 'You can only view your own token usage'
    );
  END IF;

  SELECT json_build_object(
    'todayTokens', COALESCE(SUM(CASE WHEN created_at >= p_today_start THEN total_tokens ELSE 0 END), 0),
    'monthTokens', COALESCE(SUM(CASE WHEN created_at >= p_month_start THEN total_tokens ELSE 0 END), 0),
    'todayRequests', COALESCE(COUNT(CASE WHEN created_at >= p_today_start THEN 1 END), 0),
    'todayCost', COALESCE(SUM(CASE WHEN created_at >= p_today_start THEN cost ELSE 0 END), 0),
    'monthCost', COALESCE(SUM(CASE WHEN created_at >= p_month_start THEN cost ELSE 0 END), 0),
    'tierDistribution', json_build_object(
      'fast', COALESCE(SUM(CASE WHEN created_at >= p_today_start AND tier_id = 'fast' THEN total_tokens ELSE 0 END), 0),
      'standard', COALESCE(SUM(CASE WHEN created_at >= p_today_start AND tier_id = 'standard' THEN total_tokens ELSE 0 END), 0),
      'deep', COALESCE(SUM(CASE WHEN created_at >= p_today_start AND tier_id = 'deep' THEN total_tokens ELSE 0 END), 0)
    )
  ) INTO v_result
  FROM public.token_usage_logs
  WHERE user_id = p_user_id
    AND created_at >= p_month_start;

  RETURN v_result;
END;
$$;

-- 授权执行
GRANT EXECUTE ON FUNCTION public.get_user_token_stats TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. 自动清理旧记录（保留 90 天）
-- -----------------------------------------------------------------------------

-- 创建清理函数
CREATE OR REPLACE FUNCTION public.cleanup_old_token_usage_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.token_usage_logs
  WHERE created_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- 注释
COMMENT ON TABLE public.token_usage_logs IS 'AI Token 使用记录，用于成本控制和用量分析';
COMMENT ON FUNCTION public.get_user_token_stats IS '获取用户 Token 使用统计（今日、本月）';
COMMENT ON FUNCTION public.cleanup_old_token_usage_logs IS '清理 90 天前的 Token 使用记录';

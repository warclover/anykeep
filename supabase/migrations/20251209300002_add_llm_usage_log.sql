-- V4.2 LLM Usage Log Migration
-- Track LLM API calls for cost monitoring
-- Phase 6.1.1: Cost optimization and monitoring
-- @version 1.0.0
-- @since 2025-12-09

-- 1. Create llm_usage_log table
CREATE TABLE IF NOT EXISTS public.llm_usage_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Operation context
  operation VARCHAR(50) NOT NULL, -- 'classification', 'folder_naming', 'content_analysis', 'chat', etc.
  model VARCHAR(50) NOT NULL, -- 'gpt-4o-mini', 'deepseek-chat', etc.

  -- Token usage
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,

  -- Cost (in cents for precision)
  cost_cents INT NOT NULL DEFAULT 0,

  -- Additional context
  request_id VARCHAR(100),
  metadata JSONB DEFAULT '{}'::JSONB,

  -- Timing
  execution_time_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_llm_usage_user_id ON public.llm_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_created_at ON public.llm_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_operation ON public.llm_usage_log(operation);
CREATE INDEX IF NOT EXISTS idx_llm_usage_model ON public.llm_usage_log(model);

-- Composite index for daily aggregation queries
-- Note: DATE() is not IMMUTABLE in PostgreSQL, so we use timestamp directly
-- The planner will still use this index efficiently for date range queries
CREATE INDEX IF NOT EXISTS idx_llm_usage_daily_agg
  ON public.llm_usage_log(user_id, created_at, operation);

-- 3. RLS policies
ALTER TABLE public.llm_usage_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
DROP POLICY IF EXISTS "Users can view own usage" ON public.llm_usage_log; CREATE POLICY "Users can view own usage"
  ON public.llm_usage_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service can insert usage (via service role)
DROP POLICY IF EXISTS "Service can insert usage" ON public.llm_usage_log; CREATE POLICY "Service can insert usage"
  ON public.llm_usage_log
  FOR INSERT
  WITH CHECK (true);

-- 4. Create daily usage summary view
CREATE OR REPLACE VIEW public.llm_usage_daily AS
SELECT
  user_id,
  DATE(created_at) AS date,
  operation,
  model,
  COUNT(*) AS call_count,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(total_tokens) AS total_tokens,
  SUM(cost_cents) AS total_cost_cents,
  AVG(execution_time_ms) AS avg_execution_time_ms
FROM public.llm_usage_log
GROUP BY user_id, DATE(created_at), operation, model;

-- 5. Create user monthly summary view
CREATE OR REPLACE VIEW public.llm_usage_monthly AS
SELECT
  user_id,
  TO_CHAR(created_at, 'YYYY-MM') AS month,
  COUNT(*) AS call_count,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(total_tokens) AS total_tokens,
  SUM(cost_cents) AS total_cost_cents,
  -- Breakdown by operation
  COUNT(CASE WHEN operation = 'classification' THEN 1 END) AS classification_calls,
  COUNT(CASE WHEN operation = 'folder_naming' THEN 1 END) AS naming_calls,
  COUNT(CASE WHEN operation = 'content_analysis' THEN 1 END) AS analysis_calls,
  COUNT(CASE WHEN operation = 'chat' THEN 1 END) AS chat_calls
FROM public.llm_usage_log
GROUP BY user_id, TO_CHAR(created_at, 'YYYY-MM');

-- 6. Create function to record LLM usage
CREATE OR REPLACE FUNCTION public.record_llm_usage(
  p_user_id UUID,
  p_operation VARCHAR(50),
  p_model VARCHAR(50),
  p_input_tokens INT,
  p_output_tokens INT,
  p_cost_cents INT DEFAULT 0,
  p_request_id VARCHAR(100) DEFAULT NULL,
  p_execution_time_ms INT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  INSERT INTO llm_usage_log (
    user_id, operation, model,
    input_tokens, output_tokens, cost_cents,
    request_id, execution_time_ms, metadata
  ) VALUES (
    p_user_id, p_operation, p_model,
    p_input_tokens, p_output_tokens, p_cost_cents,
    p_request_id, p_execution_time_ms, p_metadata
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 7. Create function to get user's daily cost
CREATE OR REPLACE FUNCTION public.get_user_daily_llm_cost(
  p_user_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_calls INT,
  total_tokens INT,
  total_cost_cents INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INT AS total_calls,
    COALESCE(SUM(input_tokens + output_tokens), 0)::INT AS total_tokens,
    COALESCE(SUM(cost_cents), 0)::INT AS total_cost_cents
  FROM llm_usage_log
  WHERE user_id = p_user_id
    AND DATE(created_at) = p_date;
END;
$$;

-- 8. Grant permissions
GRANT SELECT ON public.llm_usage_daily TO authenticated;
GRANT SELECT ON public.llm_usage_monthly TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_llm_usage TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_daily_llm_cost TO authenticated;

-- 9. Add comments
COMMENT ON TABLE public.llm_usage_log IS 'V4.2 LLM API usage tracking for cost monitoring';
COMMENT ON VIEW public.llm_usage_daily IS 'Daily aggregated LLM usage per user';
COMMENT ON VIEW public.llm_usage_monthly IS 'Monthly aggregated LLM usage per user';
COMMENT ON FUNCTION public.record_llm_usage IS 'Record LLM API call usage';
COMMENT ON FUNCTION public.get_user_daily_llm_cost IS 'Get user daily LLM cost summary';

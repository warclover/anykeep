-- ============================================================================
-- Migration: Create quota_operations table for Knowledge Studio
-- Description: 乐观计费操作记录表，支持配额扣除、确认、补偿机制
-- Architecture Reference: Decision 4.2 - 乐观计费 + 补偿机制
-- ============================================================================

-- Create quota_operations table
CREATE TABLE IF NOT EXISTS quota_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Operation identification
  operation_type TEXT NOT NULL,
  request_id UUID NOT NULL,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',

  -- Cost in quota units
  cost INTEGER NOT NULL,

  -- Optional: Link to synthesis report
  synthesis_report_id UUID REFERENCES synthesis_reports(id) ON DELETE SET NULL,

  -- Error tracking for failed operations
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_operation_type CHECK (
    operation_type IN ('chat_edit', 'blueprint_generation', 'material_analysis')
  ),
  CONSTRAINT valid_status CHECK (
    status IN ('pending', 'confirmed', 'refunded')
  ),
  CONSTRAINT positive_cost CHECK (cost > 0)
);

-- Add table comments
COMMENT ON TABLE quota_operations IS 'Knowledge Studio 乐观计费操作记录表';
COMMENT ON COLUMN quota_operations.operation_type IS '操作类型: chat_edit(聊天编辑), blueprint_generation(蓝图生成), material_analysis(素材分析)';
COMMENT ON COLUMN quota_operations.status IS '状态: pending(待确认), confirmed(已确认), refunded(已退还)';
COMMENT ON COLUMN quota_operations.cost IS '消耗配额单位';
COMMENT ON COLUMN quota_operations.request_id IS '请求唯一标识，用于幂等性检查';

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE quota_operations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own quota operations
CREATE POLICY "Users can view own quota operations"
  ON quota_operations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: System can insert/update (via service role)
-- Note: Insert/Update operations should use service role key for security
CREATE POLICY "Service role can manage quota operations"
  ON quota_operations
  FOR ALL
  USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Index: User + Status (for checking pending operations)
CREATE INDEX idx_quota_operations_user_status
  ON quota_operations(user_id, status);

-- Index: Request ID (for idempotency checks)
CREATE UNIQUE INDEX idx_quota_operations_request_id
  ON quota_operations(request_id);

-- Index: User + Created (for history listing)
CREATE INDEX idx_quota_operations_user_created
  ON quota_operations(user_id, created_at DESC);

-- Index: Pending operations cleanup (for refund jobs)
CREATE INDEX idx_quota_operations_pending_cleanup
  ON quota_operations(status, created_at)
  WHERE status = 'pending';

-- ============================================================================
-- RPC Functions for Atomic Operations
-- ============================================================================

-- Function: Deduct quota (optimistic)
CREATE OR REPLACE FUNCTION deduct_quota(
  p_user_id UUID,
  p_operation_type TEXT,
  p_request_id UUID,
  p_cost INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operation_id UUID;
BEGIN
  -- Insert pending operation
  INSERT INTO quota_operations (user_id, operation_type, request_id, cost, status)
  VALUES (p_user_id, p_operation_type, p_request_id, p_cost, 'pending')
  ON CONFLICT (request_id) DO UPDATE SET status = quota_operations.status
  RETURNING id INTO v_operation_id;

  RETURN v_operation_id;
END;
$$;

-- Function: Confirm quota consumption
CREATE OR REPLACE FUNCTION confirm_quota(
  p_request_id UUID,
  p_synthesis_report_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE quota_operations
  SET
    status = 'confirmed',
    confirmed_at = now(),
    synthesis_report_id = p_synthesis_report_id
  WHERE request_id = p_request_id
    AND status = 'pending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Function: Refund quota (compensation)
CREATE OR REPLACE FUNCTION refund_quota(
  p_request_id UUID,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE quota_operations
  SET
    status = 'refunded',
    refunded_at = now(),
    error_message = p_error_message
  WHERE request_id = p_request_id
    AND status = 'pending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Function: Get user's quota usage summary
CREATE OR REPLACE FUNCTION get_quota_usage_summary(
  p_user_id UUID,
  p_period_start TIMESTAMPTZ DEFAULT date_trunc('month', now()),
  p_period_end TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  total_consumed BIGINT,
  total_pending BIGINT,
  total_refunded BIGINT,
  operation_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN status = 'confirmed' THEN cost ELSE 0 END), 0)::BIGINT AS total_consumed,
    COALESCE(SUM(CASE WHEN status = 'pending' THEN cost ELSE 0 END), 0)::BIGINT AS total_pending,
    COALESCE(SUM(CASE WHEN status = 'refunded' THEN cost ELSE 0 END), 0)::BIGINT AS total_refunded,
    COUNT(*)::BIGINT AS operation_count
  FROM quota_operations
  WHERE user_id = p_user_id
    AND created_at >= p_period_start
    AND created_at <= p_period_end;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION deduct_quota(UUID, TEXT, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_quota(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION refund_quota(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_quota_usage_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

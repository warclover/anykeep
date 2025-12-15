-- V4.2.6: Add atomic trust score update function
-- Fixes race condition in source profile trust score updates
-- @version 1.0.0
-- @since 2025-12-15

-- ============================================================================
-- Atomic Trust Score Adjustment Function
-- ============================================================================

-- This function atomically adjusts the trust score for a source profile
-- using PostgreSQL's GREATEST/LEAST to ensure the score stays within [0, 100]
-- and avoiding the read-modify-write race condition

CREATE OR REPLACE FUNCTION public.adjust_source_trust_score(
  p_user_id UUID,
  p_source_id VARCHAR(255),
  p_adjustment INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_score INT;
  v_new_score INT;
  v_found BOOLEAN := FALSE;
BEGIN
  -- Atomic update using GREATEST/LEAST to clamp the value
  UPDATE source_profiles
  SET
    trust_score = GREATEST(0, LEAST(100, trust_score + p_adjustment)),
    updated_at = NOW()
  WHERE user_id = p_user_id AND source_id = p_source_id
  RETURNING
    trust_score - p_adjustment AS old_score,  -- Calculate what the old score was
    trust_score AS new_score
  INTO v_old_score, v_new_score;

  IF FOUND THEN
    v_found := TRUE;
    -- Clamp old_score for accurate reporting (in case adjustment was clamped)
    v_old_score := GREATEST(0, LEAST(100, v_old_score));
  END IF;

  RETURN jsonb_build_object(
    'found', v_found,
    'oldScore', v_old_score,
    'newScore', v_new_score,
    'adjustment', p_adjustment,
    'actualAdjustment', CASE WHEN v_found THEN v_new_score - v_old_score ELSE 0 END
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.adjust_source_trust_score TO authenticated;

-- Comment
COMMENT ON FUNCTION public.adjust_source_trust_score IS 'V4.2.6 Atomically adjust trust score for a source profile, avoiding race conditions';

-- ============================================================================
-- Migration Complete
-- ============================================================================

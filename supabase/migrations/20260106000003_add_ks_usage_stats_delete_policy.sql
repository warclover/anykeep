-- ============================================================
-- Fix: Add DELETE RLS policy for ks_usage_stats
-- MEDIUM-9: 添加 ks_usage_stats DELETE RLS 策略
-- ============================================================

-- Users can delete their own usage stats (for GDPR compliance / account cleanup)
CREATE POLICY "Users can delete own usage stats"
  ON ks_usage_stats FOR DELETE
  USING (auth.uid() = user_id);

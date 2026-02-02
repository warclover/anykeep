-- =====================================================
-- 规则遥测表 - 记录规则匹配和用户决策
-- =====================================================

CREATE TABLE IF NOT EXISTS rule_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  selection_count INTEGER NOT NULL CHECK (selection_count > 0),
  matched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted BOOLEAN,  -- null=未决定, true=接受, false=忽略
  decided_at TIMESTAMPTZ,
  session_id TEXT NOT NULL,

  -- 约束
  CONSTRAINT valid_decision CHECK (
    (accepted IS NULL AND decided_at IS NULL) OR
    (accepted IS NOT NULL AND decided_at IS NOT NULL)
  )
);

-- 索引
CREATE INDEX idx_rule_telemetry_user_id ON rule_telemetry(user_id);
CREATE INDEX idx_rule_telemetry_rule_id ON rule_telemetry(rule_id);
CREATE INDEX idx_rule_telemetry_matched_at ON rule_telemetry(matched_at DESC);
CREATE INDEX idx_rule_telemetry_session ON rule_telemetry(session_id);

-- RLS 策略
ALTER TABLE rule_telemetry ENABLE ROW LEVEL SECURITY;

-- 用户只能插入自己的遥测数据
CREATE POLICY "Users can insert own telemetry"
  ON rule_telemetry FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户只能查看自己的数据（调试用）
CREATE POLICY "Users can view own telemetry"
  ON rule_telemetry FOR SELECT
  USING (auth.uid() = user_id);

-- 管理员可以查看所有数据（分析用）
CREATE POLICY "Service role can view all telemetry"
  ON rule_telemetry FOR SELECT
  USING (auth.role() = 'service_role');

-- 30 天自动清理（如果 pg_cron 扩展可用）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-old-rule-telemetry',
      '0 3 * * *',
      $$DELETE FROM rule_telemetry WHERE matched_at < now() - INTERVAL '30 days'$$
    );
  ELSE
    RAISE NOTICE 'pg_cron extension not available, skipping scheduled cleanup';
  END IF;
END $$;

-- 聚合视图：规则效果统计
CREATE OR REPLACE VIEW rule_telemetry_stats AS
SELECT
  rule_id,
  COUNT(*) as match_count,
  COUNT(*) FILTER (WHERE accepted = true) as accept_count,
  COUNT(*) FILTER (WHERE accepted = false) as ignore_count,
  COUNT(*) FILTER (WHERE accepted IS NULL) as pending_count,
  ROUND(
    COUNT(*) FILTER (WHERE accepted = true)::NUMERIC /
    NULLIF(COUNT(*) FILTER (WHERE accepted IS NOT NULL), 0) * 100,
    2
  ) as accept_rate
FROM rule_telemetry
WHERE matched_at > now() - INTERVAL '7 days'
GROUP BY rule_id
ORDER BY match_count DESC;

COMMENT ON TABLE rule_telemetry IS '规则引擎遥测数据，用于验证规则覆盖率和用户接受度';

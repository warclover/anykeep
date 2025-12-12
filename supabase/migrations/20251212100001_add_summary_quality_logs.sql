-- ============================================================================
-- Summary Quality Logs Table
-- P5: 质量追踪系统 - 记录每次摘要生成的质量指标
-- ============================================================================

-- 创建表
CREATE TABLE IF NOT EXISTS summary_quality_logs (
  id BIGSERIAL PRIMARY KEY,
  bookmark_id BIGINT REFERENCES bookmarks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 输入追踪
  content_length INTEGER,
  content_type TEXT,                    -- article, tutorial, video, tool, social, news

  -- Provider 追踪
  provider_used TEXT NOT NULL,          -- deepseek, aliyun-bailian, ollama
  model_used TEXT NOT NULL,             -- deepseek-chat, qwen-turbo, etc.
  prompt_version TEXT,                  -- v1, v2

  -- 输出追踪
  summary_version INTEGER DEFAULT 2,    -- 1=plain text, 2=JSON structured
  summary_length INTEGER,
  tags_count INTEGER,
  latency_ms INTEGER,
  tokens_input INTEGER,
  tokens_output INTEGER,

  -- 成本追踪
  estimated_cost_cents INTEGER,         -- 估算成本（分）

  -- 质量评估
  auto_quality_score DECIMAL(3,2),      -- 自动评分 0.00-1.00
  user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
  user_feedback TEXT,

  -- 错误追踪
  error_code TEXT,
  error_message TEXT,
  fallback_used BOOLEAN DEFAULT FALSE,
  retry_count INTEGER DEFAULT 0,

  -- 性能追踪
  queue_wait_ms INTEGER,                -- 队列等待时间
  total_processing_ms INTEGER,          -- 总处理时间

  -- 审计
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加表注释
COMMENT ON TABLE summary_quality_logs IS 'AI 摘要生成质量日志，用于追踪和分析摘要质量';
COMMENT ON COLUMN summary_quality_logs.auto_quality_score IS '自动计算的质量评分 (0.00-1.00)，基于摘要长度、标签数量、响应时间等';
COMMENT ON COLUMN summary_quality_logs.user_rating IS '用户手动评分 (1-5)';
COMMENT ON COLUMN summary_quality_logs.fallback_used IS '是否使用了备用 Provider';

-- ============================================================================
-- 索引
-- ============================================================================

-- 用户查询索引
CREATE INDEX idx_summary_quality_logs_user_id
  ON summary_quality_logs(user_id);

-- Provider 分析索引
CREATE INDEX idx_summary_quality_logs_provider
  ON summary_quality_logs(provider_used);

-- 时间范围查询索引
CREATE INDEX idx_summary_quality_logs_created_at
  ON summary_quality_logs(created_at);

-- 书签关联索引
CREATE INDEX idx_summary_quality_logs_bookmark_id
  ON summary_quality_logs(bookmark_id);

-- 质量分析复合索引
CREATE INDEX idx_summary_quality_logs_quality_analysis
  ON summary_quality_logs(user_id, provider_used, created_at DESC);

-- 错误分析索引
CREATE INDEX idx_summary_quality_logs_errors
  ON summary_quality_logs(error_code)
  WHERE error_code IS NOT NULL;

-- ============================================================================
-- RLS 策略
-- ============================================================================

ALTER TABLE summary_quality_logs ENABLE ROW LEVEL SECURITY;

-- 用户可以查看自己的质量日志
CREATE POLICY "Users can view own quality logs"
  ON summary_quality_logs FOR SELECT
  USING (auth.uid() = user_id);

-- 系统可以插入质量日志
CREATE POLICY "System can insert quality logs"
  ON summary_quality_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户可以更新自己的反馈评分
CREATE POLICY "Users can update own feedback"
  ON summary_quality_logs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 触发器：自动更新 updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_summary_quality_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_summary_quality_logs_updated_at
  BEFORE UPDATE ON summary_quality_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_summary_quality_logs_updated_at();

-- ============================================================================
-- 统计函数：获取 Provider 使用统计
-- ============================================================================

CREATE OR REPLACE FUNCTION get_summary_provider_stats(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  provider TEXT,
  total_calls BIGINT,
  success_count BIGINT,
  error_count BIGINT,
  fallback_count BIGINT,
  avg_latency_ms NUMERIC,
  avg_quality_score NUMERIC,
  total_tokens BIGINT,
  total_cost_cents BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sql.provider_used as provider,
    COUNT(*)::BIGINT as total_calls,
    COUNT(*) FILTER (WHERE sql.error_code IS NULL)::BIGINT as success_count,
    COUNT(*) FILTER (WHERE sql.error_code IS NOT NULL)::BIGINT as error_count,
    COUNT(*) FILTER (WHERE sql.fallback_used = TRUE)::BIGINT as fallback_count,
    ROUND(AVG(sql.latency_ms)::NUMERIC, 2) as avg_latency_ms,
    ROUND(AVG(sql.auto_quality_score)::NUMERIC, 3) as avg_quality_score,
    COALESCE(SUM(sql.tokens_input + sql.tokens_output), 0)::BIGINT as total_tokens,
    COALESCE(SUM(sql.estimated_cost_cents), 0)::BIGINT as total_cost_cents
  FROM summary_quality_logs sql
  WHERE sql.user_id = p_user_id
    AND sql.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY sql.provider_used
  ORDER BY total_calls DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 统计函数：获取每日质量趋势
-- ============================================================================

CREATE OR REPLACE FUNCTION get_summary_daily_stats(
  p_user_id UUID,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  date DATE,
  total_summaries BIGINT,
  avg_quality_score NUMERIC,
  avg_latency_ms NUMERIC,
  error_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(sql.created_at) as date,
    COUNT(*)::BIGINT as total_summaries,
    ROUND(AVG(sql.auto_quality_score)::NUMERIC, 3) as avg_quality_score,
    ROUND(AVG(sql.latency_ms)::NUMERIC, 2) as avg_latency_ms,
    ROUND(
      (COUNT(*) FILTER (WHERE sql.error_code IS NOT NULL)::NUMERIC /
       NULLIF(COUNT(*), 0) * 100)::NUMERIC, 2
    ) as error_rate
  FROM summary_quality_logs sql
  WHERE sql.user_id = p_user_id
    AND sql.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY DATE(sql.created_at)
  ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

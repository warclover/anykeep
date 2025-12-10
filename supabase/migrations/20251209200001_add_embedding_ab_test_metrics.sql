-- V4.1+ Embedding A/B Test Metrics
-- Track embedding model performance for A/B testing
-- Phase 3.2: A/B Testing Framework

-- 1. Create embedding_ab_test_metrics table
CREATE TABLE IF NOT EXISTS public.embedding_ab_test_metrics (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Model information
  model_id VARCHAR(50) NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  dimensions INT NOT NULL DEFAULT 1024,

  -- Context
  operation_type VARCHAR(50) NOT NULL, -- 'classification', 'search', 'similarity'
  bookmark_id BIGINT REFERENCES public.bookmarks(id) ON DELETE SET NULL,
  folder_id BIGINT REFERENCES public.folders(id) ON DELETE SET NULL,

  -- Performance metrics
  execution_time_ms INT NOT NULL, -- API call duration
  token_count INT, -- Tokens used

  -- Classification result (for classification operations)
  classification_result JSONB, -- { folderId, folderName, confidence, matchType }

  -- Quality metrics (populated from user feedback)
  user_feedback VARCHAR(20), -- 'accept', 'reject', 'modify'
  feedback_folder_id BIGINT REFERENCES public.folders(id) ON DELETE SET NULL,

  -- A/B test metadata
  ab_test_group VARCHAR(20), -- 'control', 'treatment'
  ab_test_bucket INT, -- 0-99 hash bucket

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  feedback_at TIMESTAMPTZ
);

-- 2. Create indexes for efficient querying
CREATE INDEX idx_embedding_metrics_user_id ON public.embedding_ab_test_metrics(user_id);
CREATE INDEX idx_embedding_metrics_model_id ON public.embedding_ab_test_metrics(model_id);
CREATE INDEX idx_embedding_metrics_created_at ON public.embedding_ab_test_metrics(created_at DESC);
CREATE INDEX idx_embedding_metrics_operation ON public.embedding_ab_test_metrics(operation_type);
CREATE INDEX idx_embedding_metrics_ab_group ON public.embedding_ab_test_metrics(ab_test_group);

-- 3. Composite index for A/B test analysis
CREATE INDEX idx_embedding_metrics_ab_analysis
  ON public.embedding_ab_test_metrics(model_id, operation_type, created_at DESC);

-- 4. RLS policies
ALTER TABLE public.embedding_ab_test_metrics ENABLE ROW LEVEL SECURITY;

-- Users can view their own metrics
CREATE POLICY "Users can view own metrics"
  ON public.embedding_ab_test_metrics
  FOR SELECT
  USING (auth.uid() = user_id);

-- System can insert metrics (via service role)
CREATE POLICY "Service can insert metrics"
  ON public.embedding_ab_test_metrics
  FOR INSERT
  WITH CHECK (true);

-- Users can update feedback on their own metrics
CREATE POLICY "Users can update feedback"
  ON public.embedding_ab_test_metrics
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Create view for A/B test summary
CREATE OR REPLACE VIEW public.embedding_ab_test_summary AS
SELECT
  model_id,
  operation_type,
  ab_test_group,
  COUNT(*) as total_count,
  AVG(execution_time_ms) as avg_execution_time_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_time_ms) as median_execution_time_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95_execution_time_ms,
  AVG(token_count) as avg_token_count,
  COUNT(CASE WHEN user_feedback = 'accept' THEN 1 END)::FLOAT /
    NULLIF(COUNT(user_feedback), 0) as acceptance_rate,
  COUNT(CASE WHEN user_feedback IS NOT NULL THEN 1 END) as feedback_count,
  DATE_TRUNC('day', created_at) as date
FROM public.embedding_ab_test_metrics
GROUP BY model_id, operation_type, ab_test_group, DATE_TRUNC('day', created_at);

-- 6. Grant permissions
GRANT SELECT ON public.embedding_ab_test_summary TO authenticated;

COMMENT ON TABLE public.embedding_ab_test_metrics IS 'V4.1+ Embedding A/B test metrics for model comparison';
COMMENT ON VIEW public.embedding_ab_test_summary IS 'Aggregated A/B test results by model, operation, and date';

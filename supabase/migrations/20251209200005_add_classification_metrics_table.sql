-- V4.1+ Classification Metrics Table
-- 记录分类服务的详细指标，用于效果验证和监控
-- Phase 1.1: 分类指标埋点
-- @version 1.0.0
-- @since 2025-12-09

-- 1. 创建分类指标表
CREATE TABLE IF NOT EXISTS public.classification_metrics (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 书签信息
  bookmark_id BIGINT REFERENCES public.bookmarks(id) ON DELETE SET NULL,
  bookmark_url TEXT,

  -- 分类结果
  action VARCHAR(20) NOT NULL, -- 'classify', 'suggest_create', 'inbox'
  folder_id BIGINT REFERENCES public.folders(id) ON DELETE SET NULL,
  folder_name TEXT,
  confidence INT NOT NULL CHECK (confidence >= 0 AND confidence <= 100),

  -- 分层信息
  tier SMALLINT NOT NULL CHECK (tier >= 0 AND tier <= 3), -- 0=inbox, 1=fast, 2=ai_confirm, 3=auto_create
  cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
  ai_called BOOLEAN NOT NULL DEFAULT FALSE,

  -- 匹配详情
  match_type VARCHAR(50), -- 'profile', 'name', 'ai_select', 'ai_create', 'correction_cache'
  vector_score FLOAT,
  history_score FLOAT,
  ai_score FLOAT,

  -- 性能指标
  execution_time_ms INT NOT NULL,
  tier0_time_ms INT, -- 纠错缓存查询耗时
  tier1_time_ms INT, -- 快速匹配耗时
  tier2_time_ms INT, -- AI 确认耗时
  tier3_time_ms INT, -- 自动创建评估耗时

  -- 追踪信息
  trace_id VARCHAR(36),
  decision_reason TEXT,

  -- 用户反馈 (稍后由反馈 API 更新)
  user_feedback VARCHAR(20), -- 'accept', 'reject', 'modify'
  feedback_folder_id BIGINT REFERENCES public.folders(id) ON DELETE SET NULL,
  feedback_at TIMESTAMPTZ,

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. 创建索引
CREATE INDEX idx_classification_metrics_user_id
  ON public.classification_metrics(user_id);

CREATE INDEX idx_classification_metrics_created_at
  ON public.classification_metrics(created_at DESC);

CREATE INDEX idx_classification_metrics_tier
  ON public.classification_metrics(tier);

CREATE INDEX idx_classification_metrics_action
  ON public.classification_metrics(action);

-- 复合索引：用于分析查询
CREATE INDEX idx_classification_metrics_analysis
  ON public.classification_metrics(user_id, tier, created_at DESC);

-- 3. RLS 策略
ALTER TABLE public.classification_metrics ENABLE ROW LEVEL SECURITY;

-- 用户可以查看自己的指标
CREATE POLICY "Users can view own classification metrics"
  ON public.classification_metrics
  FOR SELECT
  USING (auth.uid() = user_id);

-- 系统可以插入指标 (via service role)
CREATE POLICY "Service can insert classification metrics"
  ON public.classification_metrics
  FOR INSERT
  WITH CHECK (true);

-- 用户可以更新自己的反馈
CREATE POLICY "Users can update own feedback"
  ON public.classification_metrics
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. 创建每日汇总视图
CREATE OR REPLACE VIEW public.classification_metrics_daily AS
SELECT
  DATE_TRUNC('day', created_at) as date,
  user_id,
  COUNT(*) as total_count,
  -- Tier 分布
  COUNT(CASE WHEN tier = 0 THEN 1 END) as inbox_count,
  COUNT(CASE WHEN tier = 1 THEN 1 END) as tier1_count,
  COUNT(CASE WHEN tier = 2 THEN 1 END) as tier2_count,
  COUNT(CASE WHEN tier = 3 THEN 1 END) as tier3_count,
  -- AI 调用率
  COUNT(CASE WHEN ai_called THEN 1 END)::FLOAT / NULLIF(COUNT(*), 0) as ai_call_rate,
  COUNT(CASE WHEN cache_hit THEN 1 END)::FLOAT / NULLIF(COUNT(*), 0) as cache_hit_rate,
  -- 置信度
  AVG(confidence) as avg_confidence,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY confidence) as median_confidence,
  -- 性能
  AVG(execution_time_ms) as avg_execution_time_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95_execution_time_ms,
  -- 反馈率
  COUNT(CASE WHEN user_feedback = 'accept' THEN 1 END)::FLOAT /
    NULLIF(COUNT(user_feedback), 0) as acceptance_rate,
  COUNT(CASE WHEN user_feedback IS NOT NULL THEN 1 END) as feedback_count
FROM public.classification_metrics
GROUP BY DATE_TRUNC('day', created_at), user_id;

-- 5. 创建全局汇总视图 (管理员使用)
CREATE OR REPLACE VIEW public.classification_metrics_summary AS
SELECT
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_count,
  COUNT(DISTINCT user_id) as unique_users,
  -- Tier 分布
  COUNT(CASE WHEN tier = 0 THEN 1 END) as inbox_count,
  COUNT(CASE WHEN tier = 1 THEN 1 END) as tier1_count,
  COUNT(CASE WHEN tier = 2 THEN 1 END) as tier2_count,
  COUNT(CASE WHEN tier = 3 THEN 1 END) as tier3_count,
  -- AI 指标
  COUNT(CASE WHEN ai_called THEN 1 END)::FLOAT / NULLIF(COUNT(*), 0) as ai_call_rate,
  COUNT(CASE WHEN NOT ai_called AND tier > 0 THEN 1 END)::FLOAT / NULLIF(COUNT(*), 0) as ai_skip_rate,
  COUNT(CASE WHEN cache_hit THEN 1 END)::FLOAT / NULLIF(COUNT(*), 0) as cache_hit_rate,
  -- 置信度
  AVG(confidence) as avg_confidence,
  -- 性能
  AVG(execution_time_ms) as avg_execution_time_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95_execution_time_ms,
  -- 反馈
  COUNT(CASE WHEN user_feedback = 'accept' THEN 1 END)::FLOAT /
    NULLIF(COUNT(user_feedback), 0) as acceptance_rate,
  COUNT(CASE WHEN user_feedback IS NOT NULL THEN 1 END) as feedback_count
FROM public.classification_metrics
GROUP BY DATE_TRUNC('day', created_at);

-- 6. 授予权限
GRANT SELECT ON public.classification_metrics_daily TO authenticated;
-- classification_metrics_summary 视图仅限管理员访问（通过 service role）

-- 7. 添加注释
COMMENT ON TABLE public.classification_metrics IS 'V4.1+ 分类服务指标表，记录每次分类的详细信息用于效果验证';
COMMENT ON VIEW public.classification_metrics_daily IS '用户每日分类指标汇总';
COMMENT ON VIEW public.classification_metrics_summary IS '全局分类指标汇总（管理员）';

-- 8. 创建记录指标的 RPC 函数
CREATE OR REPLACE FUNCTION public.record_classification_metrics(
  p_user_id UUID,
  p_bookmark_id BIGINT DEFAULT NULL,
  p_bookmark_url TEXT DEFAULT NULL,
  p_action VARCHAR(20) DEFAULT 'classify',
  p_folder_id BIGINT DEFAULT NULL,
  p_folder_name TEXT DEFAULT NULL,
  p_confidence INT DEFAULT 0,
  p_tier SMALLINT DEFAULT 0,
  p_cache_hit BOOLEAN DEFAULT FALSE,
  p_ai_called BOOLEAN DEFAULT FALSE,
  p_match_type VARCHAR(50) DEFAULT NULL,
  p_vector_score FLOAT DEFAULT NULL,
  p_history_score FLOAT DEFAULT NULL,
  p_ai_score FLOAT DEFAULT NULL,
  p_execution_time_ms INT DEFAULT 0,
  p_tier0_time_ms INT DEFAULT NULL,
  p_tier1_time_ms INT DEFAULT NULL,
  p_tier2_time_ms INT DEFAULT NULL,
  p_tier3_time_ms INT DEFAULT NULL,
  p_trace_id VARCHAR(36) DEFAULT NULL,
  p_decision_reason TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  INSERT INTO classification_metrics (
    user_id, bookmark_id, bookmark_url, action, folder_id, folder_name,
    confidence, tier, cache_hit, ai_called, match_type,
    vector_score, history_score, ai_score,
    execution_time_ms, tier0_time_ms, tier1_time_ms, tier2_time_ms, tier3_time_ms,
    trace_id, decision_reason
  ) VALUES (
    p_user_id, p_bookmark_id, p_bookmark_url, p_action, p_folder_id, p_folder_name,
    p_confidence, p_tier, p_cache_hit, p_ai_called, p_match_type,
    p_vector_score, p_history_score, p_ai_score,
    p_execution_time_ms, p_tier0_time_ms, p_tier1_time_ms, p_tier2_time_ms, p_tier3_time_ms,
    p_trace_id, p_decision_reason
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.record_classification_metrics IS '记录分类指标，返回指标 ID';
GRANT EXECUTE ON FUNCTION public.record_classification_metrics TO authenticated;

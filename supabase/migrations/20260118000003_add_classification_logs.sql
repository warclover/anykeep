-- ============================================
-- Classification v5.0 - 分类日志表
-- 创建日期: 2026-01-18
-- 说明: 记录分类决策、用户反馈和性能指标
-- ============================================

-- ============================================
-- 表: classification_logs（分类日志）
-- ============================================
CREATE TABLE IF NOT EXISTS classification_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id BIGINT REFERENCES bookmarks(id) ON DELETE SET NULL,

  -- 输入信息
  input_title TEXT,
  input_tags TEXT[],
  input_embedding vector(1024),

  -- 建议结果
  suggested_folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL,
  suggested_folder_name TEXT,
  suggested_confidence DECIMAL(3,2),

  -- 实际结果
  actual_folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL,
  actual_folder_name TEXT,
  feedback_type VARCHAR(20), -- 'accept' | 'reject' | 'modify'

  -- 分析数据
  top_candidates JSONB, -- Top 5 候选文件夹详情
  execution_time_ms INTEGER,
  llm_called BOOLEAN DEFAULT FALSE,
  classification_source VARCHAR(50), -- 'vector' | 'rule' | 'llm' | 'user_rule'

  -- 审计
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 添加表注释
COMMENT ON TABLE classification_logs IS '智能分类 v5.0 - 分类日志表，记录所有分类决策和用户反馈';
COMMENT ON COLUMN classification_logs.input_embedding IS '输入书签的向量表示';
COMMENT ON COLUMN classification_logs.suggested_confidence IS '建议的置信度（0-1）';
COMMENT ON COLUMN classification_logs.feedback_type IS '用户反馈类型：accept（接受）、reject（拒绝）、modify（修改）';
COMMENT ON COLUMN classification_logs.top_candidates IS 'JSON格式存储Top 5候选文件夹的详细信息';
COMMENT ON COLUMN classification_logs.classification_source IS '分类来源：vector（向量检索）、rule（规则匹配）、llm（LLM裁决）、user_rule（用户自定义规则）';

-- ============================================
-- 索引
-- ============================================

-- 用户查询索引
CREATE INDEX idx_classification_logs_user
ON classification_logs(user_id, created_at DESC);

-- 反馈类型索引（用于统计分析）
CREATE INDEX idx_classification_logs_feedback
ON classification_logs(user_id, feedback_type)
WHERE feedback_type IS NOT NULL;

-- 日期范围查询索引
CREATE INDEX idx_classification_logs_date
ON classification_logs(created_at DESC);

-- 书签关联索引
CREATE INDEX idx_classification_logs_bookmark
ON classification_logs(bookmark_id)
WHERE bookmark_id IS NOT NULL;

-- ============================================
-- RLS 策略
-- ============================================

ALTER TABLE classification_logs ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的日志
CREATE POLICY "Users can view own classification logs"
  ON classification_logs FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能插入自己的日志
CREATE POLICY "Users can insert own classification logs"
  ON classification_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的日志（主要用于添加反馈）
CREATE POLICY "Users can update own classification logs"
  ON classification_logs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 触发器：自动更新 updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_classification_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_classification_logs_updated_at
BEFORE UPDATE ON classification_logs
FOR EACH ROW
EXECUTE FUNCTION update_classification_logs_updated_at();

-- ============================================
-- 分析视图：分类准确率统计
-- ============================================

CREATE OR REPLACE VIEW classification_accuracy_stats AS
SELECT
  user_id,
  DATE_TRUNC('day', created_at) AS date,
  COUNT(*) AS total_classifications,
  COUNT(*) FILTER (WHERE feedback_type = 'accept') AS accepted_count,
  COUNT(*) FILTER (WHERE feedback_type = 'modify') AS modified_count,
  COUNT(*) FILTER (WHERE feedback_type = 'reject') AS rejected_count,
  ROUND(
    COUNT(*) FILTER (WHERE feedback_type = 'accept')::NUMERIC /
    NULLIF(COUNT(*) FILTER (WHERE feedback_type IS NOT NULL), 0) * 100,
    2
  ) AS acceptance_rate,
  ROUND(AVG(execution_time_ms), 2) AS avg_execution_time_ms,
  COUNT(*) FILTER (WHERE llm_called = TRUE) AS llm_call_count
FROM classification_logs
WHERE feedback_type IS NOT NULL
GROUP BY user_id, DATE_TRUNC('day', created_at);

COMMENT ON VIEW classification_accuracy_stats IS '分类准确率统计视图，按用户和日期聚合';

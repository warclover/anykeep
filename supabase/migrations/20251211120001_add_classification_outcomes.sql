-- V4.2 Classification Outcomes Table
-- 用于跟踪分类准确率统计

-- ============================================================================
-- 分类结果记录表
-- ============================================================================

CREATE TABLE IF NOT EXISTS classification_outcomes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id BIGINT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL,

  -- 预测置信度 (0-100)
  predicted_confidence SMALLINT NOT NULL CHECK (predicted_confidence BETWEEN 0 AND 100),

  -- 是否正确（由用户反馈确认）
  is_correct BOOLEAN DEFAULT NULL,

  -- 反馈来源
  feedback_source VARCHAR(50) DEFAULT NULL,

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 索引
-- ============================================================================

-- 用户索引（主查询路径）
CREATE INDEX IF NOT EXISTS idx_classification_outcomes_user_id
  ON classification_outcomes(user_id);

-- 用户+书签索引（查找特定记录）
CREATE INDEX IF NOT EXISTS idx_classification_outcomes_user_bookmark
  ON classification_outcomes(user_id, bookmark_id);

-- 用户+文件夹索引（文件夹级别统计）
CREATE INDEX IF NOT EXISTS idx_classification_outcomes_user_folder
  ON classification_outcomes(user_id, folder_id);

-- 用户+时间索引（时间范围查询）
CREATE INDEX IF NOT EXISTS idx_classification_outcomes_user_time
  ON classification_outcomes(user_id, created_at DESC);

-- 置信度范围索引（校准曲线计算）
CREATE INDEX IF NOT EXISTS idx_classification_outcomes_confidence
  ON classification_outcomes(user_id, predicted_confidence);

-- ============================================================================
-- RLS 策略
-- ============================================================================

ALTER TABLE classification_outcomes ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的记录
CREATE POLICY "Users can view own classification outcomes"
  ON classification_outcomes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own classification outcomes"
  ON classification_outcomes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own classification outcomes"
  ON classification_outcomes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 更新触发器
-- ============================================================================

CREATE OR REPLACE FUNCTION update_classification_outcome_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_classification_outcome_timestamp ON classification_outcomes;

CREATE TRIGGER trigger_update_classification_outcome_timestamp
  BEFORE UPDATE ON classification_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION update_classification_outcome_timestamp();

-- ============================================================================
-- 汇总视图（用于快速统计）
-- ============================================================================

CREATE OR REPLACE VIEW classification_accuracy_summary AS
SELECT
  user_id,
  COUNT(*) as total_predictions,
  COUNT(*) FILTER (WHERE is_correct = true) as correct_predictions,
  COUNT(*) FILTER (WHERE is_correct = false) as incorrect_predictions,
  COUNT(*) FILTER (WHERE is_correct IS NULL) as pending_feedback,
  CASE
    WHEN COUNT(*) FILTER (WHERE is_correct IS NOT NULL) > 0
    THEN ROUND(
      COUNT(*) FILTER (WHERE is_correct = true)::NUMERIC /
      COUNT(*) FILTER (WHERE is_correct IS NOT NULL) * 100,
      2
    )
    ELSE 0
  END as accuracy_percent,
  MIN(created_at) as first_prediction,
  MAX(created_at) as last_prediction
FROM classification_outcomes
GROUP BY user_id;

-- ============================================================================
-- 文件夹准确率视图
-- ============================================================================

CREATE OR REPLACE VIEW folder_classification_accuracy AS
SELECT
  user_id,
  folder_id,
  COUNT(*) as total_predictions,
  COUNT(*) FILTER (WHERE is_correct = true) as correct_predictions,
  CASE
    WHEN COUNT(*) FILTER (WHERE is_correct IS NOT NULL) > 0
    THEN ROUND(
      COUNT(*) FILTER (WHERE is_correct = true)::NUMERIC /
      COUNT(*) FILTER (WHERE is_correct IS NOT NULL) * 100,
      2
    )
    ELSE 0
  END as accuracy_percent
FROM classification_outcomes
WHERE folder_id IS NOT NULL
GROUP BY user_id, folder_id;

-- ============================================================================
-- 注释
-- ============================================================================

COMMENT ON TABLE classification_outcomes IS 'V4.2 分类结果记录表，用于准确率统计和置信度校准';
COMMENT ON COLUMN classification_outcomes.predicted_confidence IS '预测时的置信度 (0-100)';
COMMENT ON COLUMN classification_outcomes.is_correct IS '预测是否正确，NULL 表示待反馈';
COMMENT ON COLUMN classification_outcomes.feedback_source IS '反馈来源：manual_move, confirm, reject 等';
COMMENT ON VIEW classification_accuracy_summary IS '用户分类准确率汇总视图';
COMMENT ON VIEW folder_classification_accuracy IS '文件夹级别分类准确率视图';

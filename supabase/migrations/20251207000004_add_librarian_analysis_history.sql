-- ============================================================================
-- V3.0 整理大师 (AI Librarian) 分析历史表
-- ============================================================================
-- 用途: 存储用户的文件夹结构分析历史，支持趋势追踪和效果评估
-- 依赖: profiles 表（通过 user_id）
-- ============================================================================

-- 创建分析历史表
CREATE TABLE IF NOT EXISTS librarian_analysis_history (
  id BIGSERIAL PRIMARY KEY,

  -- 用户关联
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 健康评分
  health_score INTEGER NOT NULL CHECK (health_score >= 0 AND health_score <= 100),

  -- 问题统计
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  empty_count INTEGER NOT NULL DEFAULT 0,
  oversized_count INTEGER NOT NULL DEFAULT 0,
  poorly_named_count INTEGER NOT NULL DEFAULT 0,
  missing_count INTEGER NOT NULL DEFAULT 0,

  -- 完整分析数据（JSONB 存储详细信息）
  analysis_data JSONB NOT NULL DEFAULT '{}',

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_librarian_history_user_id
  ON librarian_analysis_history(user_id);

CREATE INDEX IF NOT EXISTS idx_librarian_history_created_at
  ON librarian_analysis_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_librarian_history_user_created
  ON librarian_analysis_history(user_id, created_at DESC);

-- RLS 策略
ALTER TABLE librarian_analysis_history ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的分析历史
CREATE POLICY "Users can view own librarian history"
  ON librarian_analysis_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 用户只能插入自己的分析记录（通过服务端 API）
CREATE POLICY "Users can insert own librarian history"
  ON librarian_analysis_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 分析历史不允许更新和删除（保留完整历史）
-- 如需清理旧数据，可通过定时任务处理

-- 添加注释
COMMENT ON TABLE librarian_analysis_history IS 'V3.0 整理大师分析历史表';
COMMENT ON COLUMN librarian_analysis_history.health_score IS '文件夹结构健康评分 (0-100)';
COMMENT ON COLUMN librarian_analysis_history.duplicate_count IS '检测到的重复文件夹数量';
COMMENT ON COLUMN librarian_analysis_history.empty_count IS '检测到的空文件夹数量';
COMMENT ON COLUMN librarian_analysis_history.oversized_count IS '检测到的过大文件夹数量';
COMMENT ON COLUMN librarian_analysis_history.poorly_named_count IS '检测到的命名问题文件夹数量';
COMMENT ON COLUMN librarian_analysis_history.missing_count IS '建议创建的缺失分类数量';
COMMENT ON COLUMN librarian_analysis_history.analysis_data IS '完整的分析结果 JSON 数据';

-- V3.0 回溯分类日志表
-- 记录自动创建文件夹后的回溯分类历史，支持撤销操作

-- ============================================================================
-- 回溯分类日志表
-- ============================================================================

CREATE TABLE IF NOT EXISTS backfill_classification_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id BIGINT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  bookmark_id BIGINT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,

  -- 匹配信息
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  match_reason JSONB DEFAULT '{}'::jsonb,
  -- match_reason 结构示例:
  -- {
  --   "universalCategoryMatch": true,
  --   "tagOverlap": 0.6,
  --   "vectorSimilarity": 0.85,
  --   "matchedTags": ["React", "前端"]
  -- }

  -- 触发信息
  trigger_type TEXT NOT NULL DEFAULT 'folder_created',
  -- trigger_type: 'folder_created' | 'manual_request' | 'scheduled'

  -- 撤销状态
  undone BOOLEAN DEFAULT FALSE,
  undone_at TIMESTAMPTZ,
  undone_by TEXT, -- 'user' | 'system'

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 确保同一书签只能被回溯分类一次到同一文件夹
  UNIQUE (bookmark_id, folder_id)
);

-- 添加注释
COMMENT ON TABLE backfill_classification_log IS 'V3.0 回溯分类日志，记录自动整理待分类内容的历史';
COMMENT ON COLUMN backfill_classification_log.confidence IS '匹配置信度 (0-100)';
COMMENT ON COLUMN backfill_classification_log.match_reason IS '匹配原因详情 (JSON)';
COMMENT ON COLUMN backfill_classification_log.trigger_type IS '触发类型：folder_created/manual_request/scheduled';
COMMENT ON COLUMN backfill_classification_log.undone IS '是否已撤销';

-- ============================================================================
-- 索引
-- ============================================================================

-- 按用户和文件夹查询（用于撤销操作）
CREATE INDEX IF NOT EXISTS idx_backfill_log_user_folder
ON backfill_classification_log (user_id, folder_id)
WHERE undone = FALSE;

-- 按创建时间查询（用于统计和清理）
CREATE INDEX IF NOT EXISTS idx_backfill_log_created
ON backfill_classification_log (created_at DESC);

-- 按书签查询（检查是否已被回溯分类）
CREATE INDEX IF NOT EXISTS idx_backfill_log_bookmark
ON backfill_classification_log (bookmark_id)
WHERE undone = FALSE;

-- ============================================================================
-- RLS 策略
-- ============================================================================

ALTER TABLE backfill_classification_log ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的回溯分类日志
CREATE POLICY "Users can view own backfill logs"
ON backfill_classification_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 用户只能插入自己的回溯分类日志
CREATE POLICY "Users can insert own backfill logs"
ON backfill_classification_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的回溯分类日志（撤销操作）
CREATE POLICY "Users can update own backfill logs"
ON backfill_classification_log
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 辅助函数：批量撤销回溯分类
-- ============================================================================

CREATE OR REPLACE FUNCTION undo_backfill_classification(
  p_user_id UUID,
  p_folder_id BIGINT,
  p_created_after TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  undone_count INTEGER,
  bookmark_ids BIGINT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bookmark_ids BIGINT[];
  v_count INTEGER;
BEGIN
  -- 查找需要撤销的书签
  SELECT ARRAY_AGG(bookmark_id)
  INTO v_bookmark_ids
  FROM backfill_classification_log
  WHERE user_id = p_user_id
    AND folder_id = p_folder_id
    AND undone = FALSE
    AND (p_created_after IS NULL OR created_at >= p_created_after);

  -- 如果没有需要撤销的记录
  IF v_bookmark_ids IS NULL OR array_length(v_bookmark_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 0::INTEGER, ARRAY[]::BIGINT[];
    RETURN;
  END IF;

  v_count := array_length(v_bookmark_ids, 1);

  -- 将书签移回待整理（folder_id = NULL）
  UPDATE bookmarks
  SET folder_id = NULL,
      updated_at = NOW()
  WHERE id = ANY(v_bookmark_ids)
    AND user_id = p_user_id;

  -- 标记日志为已撤销
  UPDATE backfill_classification_log
  SET undone = TRUE,
      undone_at = NOW(),
      undone_by = 'user'
  WHERE user_id = p_user_id
    AND folder_id = p_folder_id
    AND undone = FALSE
    AND (p_created_after IS NULL OR created_at >= p_created_after);

  RETURN QUERY SELECT v_count, v_bookmark_ids;
END;
$$;

COMMENT ON FUNCTION undo_backfill_classification IS '批量撤销指定文件夹的回溯分类';

-- ============================================================================
-- 辅助函数：获取回溯分类统计
-- ============================================================================

CREATE OR REPLACE FUNCTION get_backfill_stats(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_backfilled INTEGER,
  total_undone INTEGER,
  folders_affected INTEGER,
  avg_confidence NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_backfilled,
    COUNT(*) FILTER (WHERE undone = TRUE)::INTEGER AS total_undone,
    COUNT(DISTINCT folder_id)::INTEGER AS folders_affected,
    ROUND(AVG(confidence)::NUMERIC, 1) AS avg_confidence
  FROM backfill_classification_log
  WHERE user_id = p_user_id
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$;

COMMENT ON FUNCTION get_backfill_stats IS '获取用户的回溯分类统计';

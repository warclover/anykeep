-- ============================================================================
-- Migration: 扩展 review_sessions 表以支持理解深度评估 (Brain-Sync v2.0)
-- ============================================================================

-- 1. 新增理解深度字段
ALTER TABLE review_sessions
ADD COLUMN IF NOT EXISTS comprehension VARCHAR(20);

-- 2. 添加约束（先删除已存在的约束避免重复）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'review_sessions_comprehension_check'
  ) THEN
    ALTER TABLE review_sessions
    ADD CONSTRAINT review_sessions_comprehension_check
    CHECK (comprehension IS NULL OR comprehension IN ('new_insight', 'reinforced', 'still_confused', 'skipped'));
  END IF;
END $$;

-- 3. 新增用户笔记字段
ALTER TABLE review_sessions
ADD COLUMN IF NOT EXISTS user_note TEXT;

-- 4. 添加注释
COMMENT ON COLUMN review_sessions.comprehension IS '理解深度反馈：new_insight(有新理解)/reinforced(巩固已知)/still_confused(仍不清楚)/skipped(跳过)';
COMMENT ON COLUMN review_sessions.user_note IS '用户的思考记录';

-- 5. 创建索引以支持理解深度分析
CREATE INDEX IF NOT EXISTS idx_review_sessions_comprehension
ON review_sessions(user_id, comprehension)
WHERE comprehension IS NOT NULL;

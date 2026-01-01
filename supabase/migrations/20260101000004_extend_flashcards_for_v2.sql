-- ============================================================================
-- Migration: 扩展 flashcards 表以支持深度问题和思考提示 (Brain-Sync v2.0)
-- ============================================================================

-- 1. 新增问题深度字段
ALTER TABLE flashcards
ADD COLUMN IF NOT EXISTS question_depth VARCHAR(20) DEFAULT 'understand';

-- 2. 添加约束（先删除已存在的约束避免重复）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'flashcards_question_depth_check'
  ) THEN
    ALTER TABLE flashcards
    ADD CONSTRAINT flashcards_question_depth_check
    CHECK (question_depth IN ('understand', 'apply', 'analyze', 'evaluate'));
  END IF;
END $$;

-- 3. 新增思考提示字段
ALTER TABLE flashcards
ADD COLUMN IF NOT EXISTS thinking_hint TEXT;

-- 4. 新增参考要点字段（数组）
ALTER TABLE flashcards
ADD COLUMN IF NOT EXISTS key_points TEXT[];

-- 5. 为已存在的卡片设置默认值
-- 将现有的 answer 拆分为 key_points 数组
UPDATE flashcards
SET
  question_depth = 'understand',
  key_points = ARRAY[answer]
WHERE question_depth IS NULL OR key_points IS NULL;

-- 6. 添加注释
COMMENT ON COLUMN flashcards.question_depth IS '问题认知层次：understand(理解)/apply(应用)/analyze(分析)/evaluate(评价)';
COMMENT ON COLUMN flashcards.thinking_hint IS '思考方向提示，帮助用户思考而非直接给答案';
COMMENT ON COLUMN flashcards.key_points IS '参考要点数组，用户思考后可对照';

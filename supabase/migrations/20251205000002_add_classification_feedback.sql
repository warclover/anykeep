-- ================================================
-- 分类反馈表
-- 用于收集用户对 AI 分类建议的反馈，帮助改进分类准确性
-- ================================================

-- 1. 创建分类反馈表
CREATE TABLE IF NOT EXISTS public.classification_feedback (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 关联的建议（可选，用于追踪具体建议的反馈）
  suggestion_id BIGINT REFERENCES public.classification_suggestions(id) ON DELETE SET NULL,
  organization_suggestion_id BIGINT REFERENCES public.organization_suggestions(id) ON DELETE SET NULL,

  -- 反馈类型
  feedback_type VARCHAR(30) NOT NULL CHECK (feedback_type IN (
    'wrong_folder',        -- 分类到错误的文件夹
    'better_folder',       -- 有更好的文件夹选择
    'folder_not_exist',    -- 建议的文件夹不存在
    'confidence_too_high', -- 置信度过高
    'confidence_too_low',  -- 置信度过低
    'helpful',             -- 建议很有帮助
    'other'                -- 其他
  )),

  -- 反馈详情
  comment TEXT,

  -- 建议的正确分类（如果用户认为分类错误）
  suggested_correct_folder_id BIGINT REFERENCES public.folders(id) ON DELETE SET NULL,
  suggested_correct_folder_name VARCHAR(100),

  -- 元数据
  context JSONB DEFAULT '{}'::jsonb,

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 添加索引
CREATE INDEX IF NOT EXISTS idx_classification_feedback_user
  ON public.classification_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_classification_feedback_type
  ON public.classification_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_classification_feedback_created
  ON public.classification_feedback(created_at DESC);

-- 3. 添加 RLS 策略
ALTER TABLE public.classification_feedback ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的反馈
CREATE POLICY "Users can view own feedback"
  ON public.classification_feedback
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 用户可以创建自己的反馈
CREATE POLICY "Users can create own feedback"
  ON public.classification_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 用户可以删除自己的反馈
CREATE POLICY "Users can delete own feedback"
  ON public.classification_feedback
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. 添加注释
COMMENT ON TABLE public.classification_feedback IS '分类反馈表：收集用户对 AI 分类建议的反馈';
COMMENT ON COLUMN public.classification_feedback.feedback_type IS '反馈类型';
COMMENT ON COLUMN public.classification_feedback.comment IS '用户评论';
COMMENT ON COLUMN public.classification_feedback.suggested_correct_folder_id IS '用户建议的正确文件夹';
COMMENT ON COLUMN public.classification_feedback.context IS '上下文元数据（如原始分类结果等）';

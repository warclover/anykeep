-- =====================================================
-- V4.2 智能分类系统：分类建议表
-- 用于存储 AI 生成的收藏分类建议
-- =====================================================

-- 1. 创建分类建议表
CREATE TABLE IF NOT EXISTS public.classification_suggestions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id BIGINT NOT NULL REFERENCES public.bookmarks(id) ON DELETE CASCADE,
  suggested_folder_id BIGINT REFERENCES public.folders(id) ON DELETE SET NULL,
  suggested_folder_name VARCHAR(100) NOT NULL,
  suggest_new_folder BOOLEAN DEFAULT FALSE,
  confidence DECIMAL(5,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  batch_id UUID NOT NULL, -- 批次ID，用于关联同一批生成的建议
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE(bookmark_id, batch_id) -- 同一批次中每个书签只有一条建议
);

-- 2. 添加索引
CREATE INDEX IF NOT EXISTS idx_classification_suggestions_user_status
  ON public.classification_suggestions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_classification_suggestions_batch
  ON public.classification_suggestions(batch_id);
CREATE INDEX IF NOT EXISTS idx_classification_suggestions_bookmark
  ON public.classification_suggestions(bookmark_id);

-- 3. 启用 RLS
ALTER TABLE public.classification_suggestions ENABLE ROW LEVEL SECURITY;

-- 4. RLS 策略
-- 用户只能查看自己的建议
CREATE POLICY "Users can view own suggestions"
  ON public.classification_suggestions
  FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能更新自己的建议状态
CREATE POLICY "Users can update own suggestions"
  ON public.classification_suggestions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 服务端可以插入建议（通过 service role）
CREATE POLICY "Service can insert suggestions"
  ON public.classification_suggestions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. 在 profiles 表的 settings 中添加重分类配置
-- settings JSON 结构扩展：
-- {
--   "reclassify": {
--     "last_run_at": "2025-01-01T00:00:00Z",
--     "inbox_threshold": 10,
--     "auto_run_weekly": true
--   }
-- }

-- 6. 创建获取待处理建议数量的函数
CREATE OR REPLACE FUNCTION get_pending_suggestions_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.classification_suggestions
  WHERE user_id = p_user_id
    AND status = 'pending';

  RETURN v_count;
END;
$$;

-- 7. 创建批量接受建议的函数
CREATE OR REPLACE FUNCTION accept_classification_suggestions(
  p_user_id UUID,
  p_suggestion_ids BIGINT[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_processed INTEGER := 0;
  v_suggestion RECORD;
  v_folder_id BIGINT;
BEGIN
  FOR v_suggestion IN
    SELECT cs.*, b.user_id as bookmark_user_id
    FROM public.classification_suggestions cs
    JOIN public.bookmarks b ON b.id = cs.bookmark_id
    WHERE cs.id = ANY(p_suggestion_ids)
      AND cs.user_id = p_user_id
      AND cs.status = 'pending'
  LOOP
    -- 确保书签属于该用户
    IF v_suggestion.bookmark_user_id != p_user_id THEN
      CONTINUE;
    END IF;

    v_folder_id := v_suggestion.suggested_folder_id;

    -- 如果建议新建文件夹
    IF v_suggestion.suggest_new_folder AND v_folder_id IS NULL THEN
      INSERT INTO public.folders (user_id, name, sort_order)
      VALUES (p_user_id, v_suggestion.suggested_folder_name, 0)
      RETURNING id INTO v_folder_id;
    END IF;

    -- 移动书签到目标文件夹
    IF v_folder_id IS NOT NULL THEN
      UPDATE public.bookmarks
      SET folder_id = v_folder_id, updated_at = NOW()
      WHERE id = v_suggestion.bookmark_id
        AND user_id = p_user_id;
    END IF;

    -- 标记建议为已接受
    UPDATE public.classification_suggestions
    SET status = 'accepted', processed_at = NOW()
    WHERE id = v_suggestion.id;

    v_processed := v_processed + 1;
  END LOOP;

  RETURN v_processed;
END;
$$;

-- 8. 创建批量拒绝建议的函数
CREATE OR REPLACE FUNCTION reject_classification_suggestions(
  p_user_id UUID,
  p_suggestion_ids BIGINT[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.classification_suggestions
  SET status = 'rejected', processed_at = NOW()
  WHERE id = ANY(p_suggestion_ids)
    AND user_id = p_user_id
    AND status = 'pending';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 9. 创建过期旧建议的函数（超过7天的pending建议标记为expired）
CREATE OR REPLACE FUNCTION expire_old_suggestions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.classification_suggestions
  SET status = 'expired', processed_at = NOW()
  WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 10. 添加注释
COMMENT ON TABLE public.classification_suggestions IS 'V4.2 智能分类建议表，存储AI生成的收藏分类建议';
COMMENT ON COLUMN public.classification_suggestions.batch_id IS '批次ID，同一次重分类生成的建议共享同一个batch_id';
COMMENT ON COLUMN public.classification_suggestions.status IS 'pending=待处理, accepted=已接受, rejected=已拒绝, expired=已过期';
COMMENT ON COLUMN public.classification_suggestions.suggest_new_folder IS '是否建议创建新文件夹';

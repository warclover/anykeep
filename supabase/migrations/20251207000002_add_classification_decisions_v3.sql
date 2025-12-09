-- ================================================
-- V3.0 分类决策追踪表
-- 记录每次分类的完整决策上下文，用于反馈闭环学习
-- ================================================

-- 1. 创建分类决策表
CREATE TABLE IF NOT EXISTS public.classification_decisions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id BIGINT NOT NULL REFERENCES public.bookmarks(id) ON DELETE CASCADE,

  -- 决策结果
  decision_type VARCHAR(20) NOT NULL CHECK (decision_type IN (
    'auto_classified',    -- 高置信度自动分类
    'suggestion_shown',   -- 中置信度显示建议
    'to_inbox',           -- 低置信度进入待整理
    'knn_direct',         -- k-NN 直接锁定
    'universal_match'     -- 通用分类匹配
  )),

  -- 最终结果
  final_folder_id BIGINT REFERENCES public.folders(id) ON DELETE SET NULL,
  final_folder_name VARCHAR(100),
  confidence DECIMAL(5,2),  -- 0-100

  -- 匹配器得分详情 (JSONB 便于扩展)
  matcher_scores JSONB DEFAULT '{}'::jsonb,
  -- 示例结构:
  -- {
  --   "vector": { "score": 75.5, "top_folder_id": 123 },
  --   "history": { "score": 60.2, "matched_count": 5 },
  --   "ai": { "score": 82.1, "model": "deepseek-v3" },
  --   "universal": { "score": 45.0, "category": "technology" },
  --   "knn_direct": { "score": 95.0, "source_bookmark_id": 456 }
  -- }

  -- 候选文件夹列表
  candidates JSONB DEFAULT '[]'::jsonb,
  -- 示例: [{ "folder_id": 1, "folder_name": "技术", "score": 85 }, ...]

  -- AI 相关
  ai_skipped BOOLEAN DEFAULT FALSE,  -- 是否跳过了 AI 调用
  ai_model VARCHAR(50),              -- 使用的 AI 模型
  ai_prompt_version VARCHAR(20),     -- Prompt 版本 (e.g., "cot_v1")
  ai_response_time_ms INTEGER,       -- AI 响应时间

  -- 用户反馈 (后续填充)
  user_action VARCHAR(20) CHECK (user_action IN (
    'accepted',           -- 接受建议
    'rejected',           -- 拒绝建议
    'changed_folder',     -- 更换到其他文件夹
    'undo',               -- 撤销自动分类
    'ignored',            -- 忽略建议 (超时)
    'manual_move'         -- 手动移动到其他文件夹
  )),
  user_action_at TIMESTAMPTZ,
  user_chosen_folder_id BIGINT REFERENCES public.folders(id) ON DELETE SET NULL,

  -- 元数据
  client_version VARCHAR(20),        -- 客户端版本
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 约束：每个书签只能有一条决策记录（最新的）
  CONSTRAINT unique_bookmark_decision UNIQUE (bookmark_id)
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_classification_decisions_user
  ON public.classification_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_classification_decisions_type
  ON public.classification_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_classification_decisions_created
  ON public.classification_decisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_classification_decisions_folder
  ON public.classification_decisions(final_folder_id);
CREATE INDEX IF NOT EXISTS idx_classification_decisions_action
  ON public.classification_decisions(user_action) WHERE user_action IS NOT NULL;

-- 用于查询用户反馈模式的复合索引
CREATE INDEX IF NOT EXISTS idx_classification_decisions_feedback_pattern
  ON public.classification_decisions(user_id, decision_type, user_action)
  WHERE user_action IS NOT NULL;

-- 3. 启用 RLS
ALTER TABLE public.classification_decisions ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的决策记录
CREATE POLICY "Users can view own decisions"
  ON public.classification_decisions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 用户可以创建自己的决策记录
CREATE POLICY "Users can create own decisions"
  ON public.classification_decisions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 用户可以更新自己的决策记录（添加反馈）
CREATE POLICY "Users can update own decisions"
  ON public.classification_decisions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. 创建视图：用户分类反馈统计
CREATE OR REPLACE VIEW public.v_user_classification_stats AS
SELECT
  user_id,
  decision_type,
  user_action,
  COUNT(*) as count,
  AVG(confidence) as avg_confidence,
  COUNT(*) FILTER (WHERE user_action = 'accepted') as accepted_count,
  COUNT(*) FILTER (WHERE user_action IN ('rejected', 'changed_folder', 'undo')) as rejected_count
FROM public.classification_decisions
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id, decision_type, user_action;

-- 5. 创建函数：计算用户的匹配器权重调整
CREATE OR REPLACE FUNCTION public.calculate_matcher_weight_adjustments(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  total_decisions INTEGER;
  ai_accuracy DECIMAL;
  vector_accuracy DECIMAL;
  history_accuracy DECIMAL;
  knn_accuracy DECIMAL;
BEGIN
  -- 获取最近30天的决策数据
  SELECT COUNT(*) INTO total_decisions
  FROM public.classification_decisions
  WHERE user_id = p_user_id
    AND created_at > NOW() - INTERVAL '30 days'
    AND user_action IS NOT NULL;

  -- 如果数据不足，返回默认权重
  IF total_decisions < 10 THEN
    RETURN jsonb_build_object(
      'vector', 0.4,
      'history', 0.3,
      'ai', 0.3,
      'data_sufficient', false,
      'sample_size', total_decisions
    );
  END IF;

  -- 计算各匹配器的准确率
  -- AI 准确率：AI 推荐被接受的比例
  SELECT
    COALESCE(
      COUNT(*) FILTER (WHERE user_action = 'accepted')::DECIMAL /
      NULLIF(COUNT(*), 0),
      0.5
    ) INTO ai_accuracy
  FROM public.classification_decisions
  WHERE user_id = p_user_id
    AND created_at > NOW() - INTERVAL '30 days'
    AND decision_type IN ('auto_classified', 'suggestion_shown')
    AND user_action IS NOT NULL;

  -- k-NN 直接锁定准确率
  SELECT
    COALESCE(
      COUNT(*) FILTER (WHERE user_action NOT IN ('undo', 'changed_folder'))::DECIMAL /
      NULLIF(COUNT(*), 0),
      0.9
    ) INTO knn_accuracy
  FROM public.classification_decisions
  WHERE user_id = p_user_id
    AND created_at > NOW() - INTERVAL '30 days'
    AND decision_type = 'knn_direct'
    AND user_action IS NOT NULL;

  -- 构建结果
  result := jsonb_build_object(
    'vector', ROUND(0.4 * (1 + (ai_accuracy - 0.5) * 0.2), 2),
    'history', ROUND(0.3 * (1 + (ai_accuracy - 0.5) * 0.2), 2),
    'ai', ROUND(0.3 * (1 + (ai_accuracy - 0.5) * 0.3), 2),
    'knn_direct_threshold',
      CASE
        WHEN knn_accuracy > 0.95 THEN 0.85  -- 准确率高，降低阈值
        WHEN knn_accuracy < 0.8 THEN 0.95   -- 准确率低，提高阈值
        ELSE 0.9
      END,
    'data_sufficient', true,
    'sample_size', total_decisions,
    'ai_accuracy', ROUND(ai_accuracy, 3),
    'knn_accuracy', ROUND(knn_accuracy, 3)
  );

  RETURN result;
END;
$$;

-- 6. 添加注释
COMMENT ON TABLE public.classification_decisions IS 'V3.0 分类决策追踪表：记录每次分类的完整上下文';
COMMENT ON COLUMN public.classification_decisions.matcher_scores IS '各匹配器的得分详情';
COMMENT ON COLUMN public.classification_decisions.ai_skipped IS '是否跳过了 AI 调用（k-NN 直接锁定）';
COMMENT ON COLUMN public.classification_decisions.user_action IS '用户对分类结果的反馈动作';
COMMENT ON FUNCTION public.calculate_matcher_weight_adjustments IS '根据用户反馈计算动态权重调整';

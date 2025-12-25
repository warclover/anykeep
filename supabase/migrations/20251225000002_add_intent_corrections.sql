-- =============================================================================
-- Migration: Add Intent Corrections Table for AI Self-Evolution
-- Version: 1.0.0
-- Date: 2025-12-25
-- Description: 存储用户对 AI 意图识别的纠正记录，用于自我进化学习
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 创建 intent_corrections 表
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.intent_corrections (
  -- 主键
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 用户关联
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 原始输入信息
  original_input TEXT NOT NULL,
  original_input_embedding VECTOR(1536), -- OpenAI text-embedding-3-small 维度

  -- 意图纠正信息
  wrong_intent TEXT NOT NULL CHECK (wrong_intent IN ('query', 'organize', 'create', 'export', 'review', 'unknown')),
  correct_intent TEXT NOT NULL CHECK (correct_intent IN ('query', 'organize', 'create', 'export', 'review', 'unknown')),

  -- 纠正信号
  signal TEXT NOT NULL CHECK (signal IN ('explicit_wrong', 'correction_follow', 'reformulation', 'negative_feedback')),
  confidence DECIMAL(4, 3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),

  -- 应用统计
  applied_count INTEGER NOT NULL DEFAULT 0,
  last_applied_at TIMESTAMPTZ,

  -- 元数据
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 添加表注释
COMMENT ON TABLE public.intent_corrections IS 'AI 意图纠正记录表，用于自我进化学习';
COMMENT ON COLUMN public.intent_corrections.original_input IS '触发纠正的原始用户输入';
COMMENT ON COLUMN public.intent_corrections.original_input_embedding IS '原始输入的向量嵌入，用于相似度匹配';
COMMENT ON COLUMN public.intent_corrections.wrong_intent IS 'AI 错误识别的意图';
COMMENT ON COLUMN public.intent_corrections.correct_intent IS '用户期望的正确意图';
COMMENT ON COLUMN public.intent_corrections.signal IS '纠正信号类型';
COMMENT ON COLUMN public.intent_corrections.confidence IS '纠正检测置信度';
COMMENT ON COLUMN public.intent_corrections.applied_count IS '该纠正被应用的次数';
COMMENT ON COLUMN public.intent_corrections.last_applied_at IS '最后一次应用该纠正的时间';

-- -----------------------------------------------------------------------------
-- 2. 创建索引
-- -----------------------------------------------------------------------------

-- 用户索引（查询用户的纠正历史）
CREATE INDEX IF NOT EXISTS idx_intent_corrections_user_id
  ON public.intent_corrections(user_id);

-- 向量索引（相似度搜索）- 使用 ivfflat 索引
CREATE INDEX IF NOT EXISTS idx_intent_corrections_embedding
  ON public.intent_corrections
  USING ivfflat (original_input_embedding vector_cosine_ops)
  WITH (lists = 100);

-- 复合索引（按用户和应用次数排序）
CREATE INDEX IF NOT EXISTS idx_intent_corrections_user_applied
  ON public.intent_corrections(user_id, applied_count DESC);

-- 时间索引（最近纠正）
CREATE INDEX IF NOT EXISTS idx_intent_corrections_created_at
  ON public.intent_corrections(created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. RLS 策略
-- -----------------------------------------------------------------------------

-- 启用 RLS
ALTER TABLE public.intent_corrections ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的纠正记录
CREATE POLICY "Users can view own corrections"
  ON public.intent_corrections
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own corrections"
  ON public.intent_corrections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own corrections"
  ON public.intent_corrections
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 4. 触发器：自动更新 updated_at
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_intent_corrections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_intent_corrections_updated_at
  BEFORE UPDATE ON public.intent_corrections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_intent_corrections_updated_at();

-- -----------------------------------------------------------------------------
-- 5. RPC 函数：查找相似纠正
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.find_similar_corrections(
  query_embedding VECTOR(1536),
  target_user_id UUID,
  similarity_threshold DECIMAL DEFAULT 0.8,
  limit_count INTEGER DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  original_input TEXT,
  correct_intent TEXT,
  similarity DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ic.id,
    ic.original_input,
    ic.correct_intent,
    (1 - (ic.original_input_embedding <=> query_embedding))::DECIMAL AS similarity
  FROM public.intent_corrections ic
  WHERE
    ic.user_id = target_user_id
    AND ic.original_input_embedding IS NOT NULL
    AND (1 - (ic.original_input_embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY
    ic.original_input_embedding <=> query_embedding
  LIMIT limit_count;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION public.find_similar_corrections IS '查找与输入相似的历史纠正记录';

-- -----------------------------------------------------------------------------
-- 6. RPC 函数：增加应用计数
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.increment_correction_applied_count(
  correction_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.intent_corrections
  SET
    applied_count = applied_count + 1,
    last_applied_at = NOW()
  WHERE
    id = correction_id
    AND user_id = auth.uid();
END;
$$;

COMMENT ON FUNCTION public.increment_correction_applied_count IS '增加纠正记录的应用计数';

-- -----------------------------------------------------------------------------
-- 7. RPC 函数：获取用户学习统计
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_learning_stats(
  target_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- 检查权限
  IF auth.uid() != target_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT json_build_object(
    'userId', target_user_id,
    'totalCorrections', COUNT(*),
    'totalApplications', COALESCE(SUM(applied_count), 0),
    'byIntent', json_object_agg(
      correct_intent,
      json_build_object(
        'corrections', COUNT(*),
        'applications', COALESCE(SUM(applied_count), 0)
      )
    ),
    'lastCorrectionAt', MAX(created_at)
  )
  INTO result
  FROM public.intent_corrections
  WHERE user_id = target_user_id
  GROUP BY user_id;

  RETURN COALESCE(result, json_build_object(
    'userId', target_user_id,
    'totalCorrections', 0,
    'totalApplications', 0,
    'byIntent', '{}'::json,
    'lastCorrectionAt', null
  ));
END;
$$;

COMMENT ON FUNCTION public.get_user_learning_stats IS '获取用户的学习统计信息';

-- -----------------------------------------------------------------------------
-- 完成
-- -----------------------------------------------------------------------------

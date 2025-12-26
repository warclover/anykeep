-- =============================================================================
-- Migration: Fix Intent Corrections Table Structure
-- Version: 1.0.1
-- Date: 2025-12-26
-- Description: 修复 intent_corrections 表结构，确保所有列和约束正确
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 删除旧表并重建（包含数据迁移保护）
-- -----------------------------------------------------------------------------

-- 先检查是否有数据需要保护
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO row_count FROM public.intent_corrections;
  IF row_count > 0 THEN
    RAISE NOTICE 'intent_corrections 表有 % 条记录，将被删除重建', row_count;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'intent_corrections 表不存在，将创建新表';
END $$;

-- 删除旧的 RPC 函数（如果存在）
DROP FUNCTION IF EXISTS public.find_similar_corrections(VECTOR(1536), UUID, DECIMAL, INTEGER);
DROP FUNCTION IF EXISTS public.increment_correction_applied_count(UUID);
DROP FUNCTION IF EXISTS public.get_user_learning_stats(UUID);

-- 删除旧的触发器
DROP TRIGGER IF EXISTS trigger_intent_corrections_updated_at ON public.intent_corrections;
DROP FUNCTION IF EXISTS public.update_intent_corrections_updated_at();

-- 删除旧表
DROP TABLE IF EXISTS public.intent_corrections CASCADE;

-- -----------------------------------------------------------------------------
-- 2. 创建新表（与 IntentType 类型一致）
-- -----------------------------------------------------------------------------

CREATE TABLE public.intent_corrections (
  -- 主键
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 用户关联
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 原始输入信息
  original_input TEXT NOT NULL,
  original_input_embedding VECTOR(1536), -- OpenAI text-embedding-3-small 维度

  -- 意图纠正信息（与 router/types.ts IntentType 一致）
  wrong_intent TEXT NOT NULL CHECK (wrong_intent IN ('query', 'action', 'organize', 'analyze', 'learn', 'create', 'chitchat')),
  correct_intent TEXT NOT NULL CHECK (correct_intent IN ('query', 'action', 'organize', 'analyze', 'learn', 'create', 'chitchat')),

  -- 纠正信号
  signal TEXT NOT NULL CHECK (signal IN ('explicit_wrong', 'correction_follow', 'reformulation', 'negative_feedback')),
  confidence DECIMAL(4, 3) NOT NULL DEFAULT 0.9 CHECK (confidence >= 0 AND confidence <= 1),

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
-- 3. 创建索引
-- -----------------------------------------------------------------------------

-- 用户索引（查询用户的纠正历史）
CREATE INDEX idx_intent_corrections_user_id
  ON public.intent_corrections(user_id);

-- 向量索引（相似度搜索）- 使用 ivfflat 索引
CREATE INDEX idx_intent_corrections_embedding
  ON public.intent_corrections
  USING ivfflat (original_input_embedding vector_cosine_ops)
  WITH (lists = 100);

-- 复合索引（按用户和应用次数排序）
CREATE INDEX idx_intent_corrections_user_applied
  ON public.intent_corrections(user_id, applied_count DESC);

-- 时间索引（最近纠正）
CREATE INDEX idx_intent_corrections_created_at
  ON public.intent_corrections(created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. RLS 策略
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
-- 5. 触发器：自动更新 updated_at
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
-- 6. RPC 函数：查找相似纠正
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

COMMENT ON FUNCTION public.find_similar_corrections IS '查找与输入相似的历史纠正记录';

-- -----------------------------------------------------------------------------
-- 7. RPC 函数：增加应用计数
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
-- 8. RPC 函数：获取用户学习统计
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
    'byIntent', COALESCE(
      json_object_agg(
        correct_intent,
        json_build_object(
          'corrections', sub.cnt,
          'applications', sub.apps
        )
      ),
      '{}'::json
    ),
    'lastCorrectionAt', MAX(created_at)
  )
  INTO result
  FROM (
    SELECT
      correct_intent,
      COUNT(*) as cnt,
      COALESCE(SUM(applied_count), 0) as apps
    FROM public.intent_corrections
    WHERE user_id = target_user_id
    GROUP BY correct_intent
  ) sub
  CROSS JOIN (
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(applied_count), 0) as total_apps,
      MAX(created_at) as last_at
    FROM public.intent_corrections
    WHERE user_id = target_user_id
  ) totals;

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
-- 9. RPC 函数：撤销操作快照恢复（修复遗漏）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.revert_ai_operation_snapshot(
  p_snapshot_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  restored_count INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot RECORD;
  v_restored INT := 0;
  v_bookmark_state JSONB;
BEGIN
  -- 验证权限
  IF auth.uid() != p_user_id THEN
    RETURN QUERY SELECT FALSE, 0, 'Unauthorized'::TEXT;
    RETURN;
  END IF;

  -- 获取快照
  SELECT * INTO v_snapshot
  FROM public.ai_operation_snapshots
  WHERE id = p_snapshot_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, '快照不存在'::TEXT;
    RETURN;
  END IF;

  IF v_snapshot.is_reverted THEN
    RETURN QUERY SELECT FALSE, 0, '已撤销过'::TEXT;
    RETURN;
  END IF;

  IF v_snapshot.expires_at < NOW() THEN
    RETURN QUERY SELECT FALSE, 0, '快照已过期'::TEXT;
    RETURN;
  END IF;

  -- 恢复每个书签的状态
  FOR v_bookmark_state IN SELECT * FROM jsonb_array_elements(v_snapshot.before_state)
  LOOP
    UPDATE public.bookmarks
    SET
      folder_id = (v_bookmark_state->>'folder_id')::BIGINT,
      tags = ARRAY(SELECT jsonb_array_elements_text(v_bookmark_state->'tags')),
      updated_at = NOW()
    WHERE id = (v_bookmark_state->>'id')::BIGINT
      AND user_id = p_user_id;

    IF FOUND THEN
      v_restored := v_restored + 1;
    END IF;
  END LOOP;

  -- 标记快照为已撤销
  UPDATE public.ai_operation_snapshots
  SET
    is_reverted = TRUE,
    reverted_at = NOW()
  WHERE id = p_snapshot_id;

  RETURN QUERY SELECT TRUE, v_restored, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION public.revert_ai_operation_snapshot IS '撤销 AI 操作，恢复书签到操作前状态';

-- -----------------------------------------------------------------------------
-- 完成
-- -----------------------------------------------------------------------------

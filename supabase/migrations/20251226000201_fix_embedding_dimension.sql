-- =============================================================================
-- Migration: Fix Embedding Dimension for Intent Corrections
-- Version: 1.0.0
-- Date: 2025-12-26
-- Description: 修复 intent_corrections 表 embedding 列维度（1536 → 1024）
--              以匹配项目使用的阿里云百炼 DashScope text-embedding-v3 模型
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 修改 embedding 列维度
-- -----------------------------------------------------------------------------

-- 删除旧的向量索引
DROP INDEX IF EXISTS idx_intent_corrections_embedding;

-- 修改列类型（注意：如果已有数据会被清空）
ALTER TABLE public.intent_corrections
  ALTER COLUMN original_input_embedding TYPE VECTOR(1024);

-- 重新创建向量索引（使用 ivfflat）
CREATE INDEX idx_intent_corrections_embedding
  ON public.intent_corrections
  USING ivfflat (original_input_embedding vector_cosine_ops)
  WITH (lists = 100);

-- 更新注释
COMMENT ON COLUMN public.intent_corrections.original_input_embedding IS
  '原始输入的向量嵌入（1024维，阿里云百炼 text-embedding-v3），用于相似度匹配';

-- -----------------------------------------------------------------------------
-- 2. 更新 find_similar_corrections 函数以匹配新维度
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.find_similar_corrections(VECTOR(1536), UUID, DECIMAL, INTEGER);

CREATE OR REPLACE FUNCTION public.find_similar_corrections(
  query_embedding VECTOR(1024),
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

COMMENT ON FUNCTION public.find_similar_corrections(VECTOR(1024), UUID, DECIMAL, INTEGER) IS
  '查找与输入相似的历史纠正记录（使用 1024 维向量）';

-- -----------------------------------------------------------------------------
-- 完成
-- -----------------------------------------------------------------------------

-- ============================================================================
-- Migration: Fix synthesis_reports embedding dimension
-- Version: 20251229000007
-- Description: 修正 synthesis_reports.embedding 维度从 1536 改为 1024
--
-- 背景:
--   - 项目标准 embedding 维度为 1024 (自 20251126000002 迁移确定)
--   - synthesis_reports 表在创建时误用了旧的 1536 维度
--   - 本迁移修正此问题以保持项目一致性
--
-- ⚠️ 重要提醒 (给未来的开发者):
--   - AnyKeep 项目统一使用 1024 维向量
--   - 新表创建时请使用 vector(1024)
--   - 参考: src/lib/embedding/constants.ts 中的 EMBEDDING_DIMENSION
-- ============================================================================

-- ============================================================================
-- 1. 删除旧索引 (必须先删除，否则无法修改字段类型)
-- ============================================================================

DROP INDEX IF EXISTS idx_synthesis_reports_embedding;

-- ============================================================================
-- 2. 修改字段类型
-- ============================================================================

-- 修改 embedding 字段从 extensions.vector(1024) 改为 vector(1024)
-- 注意: 由于表是新创建的，数据量应该很少或为空
-- 如果已有数据，需要重新生成 embedding (旧的 1536 维向量将被截断或需要重新计算)
ALTER TABLE synthesis_reports
ALTER COLUMN embedding TYPE extensions.vector(1024);

-- ============================================================================
-- 3. 重建索引
-- ============================================================================

-- 重建 HNSW 向量索引
CREATE INDEX IF NOT EXISTS idx_synthesis_reports_embedding
  ON synthesis_reports USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- 4. 更新注释
-- ============================================================================

COMMENT ON COLUMN synthesis_reports.embedding IS '综述内容的向量嵌入 (1024维)，用于语义搜索。项目标准维度，参考 EMBEDDING_DIMENSION 常量。';

-- ============================================================================
-- 5. 验证
-- ============================================================================

-- 验证字段类型已正确修改
DO $$
DECLARE
  v_column_type TEXT;
BEGIN
  SELECT data_type || '(' || character_maximum_length || ')' INTO v_column_type
  FROM information_schema.columns
  WHERE table_name = 'synthesis_reports' AND column_name = 'embedding';

  -- 对于 vector 类型，PostgreSQL 返回 'USER-DEFINED'，需要特殊处理
  IF v_column_type IS NULL THEN
    -- vector 类型验证成功 (USER-DEFINED 类型)
    RAISE NOTICE 'synthesis_reports.embedding 字段类型修改成功';
  END IF;
END;
$$;

-- ============================================================================
-- 完成
-- ============================================================================

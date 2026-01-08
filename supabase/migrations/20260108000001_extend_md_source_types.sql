-- Migration: 20260108000001_extend_md_source_types.sql
-- Save to Note 功能：扩展 source_type 并添加 source_metadata

-- ============================================
-- 1. 添加 source_metadata 字段
-- ============================================
ALTER TABLE md_collections
ADD COLUMN IF NOT EXISTS source_metadata JSONB DEFAULT NULL;

COMMENT ON COLUMN md_collections.source_metadata IS '来源元数据：sourceId, conversationId 等';

-- ============================================
-- 2. 更新 source_type 约束（如果有）
-- 注：当前 source_type 是 VARCHAR(20)，无枚举约束
-- 只需添加索引和注释
-- ============================================

-- 更新注释说明新的来源类型
COMMENT ON COLUMN md_collections.source_type IS '来源类型：upload/paste/api/ai_response/deliverable/synthesis/report';

-- ============================================
-- 3. 添加索引优化查询
-- ============================================

-- source_metadata 索引（用于按 sourceId 查询）
CREATE INDEX IF NOT EXISTS idx_md_collections_source_metadata_gin
ON md_collections USING GIN (source_metadata)
WHERE deleted_at IS NULL AND source_metadata IS NOT NULL;

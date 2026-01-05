-- ============================================================================
-- Migration: Drop blueprint_type constraint for v2 compatibility
-- Description: 移除 blueprint_type 的 CHECK 约束，支持 v2 蓝图系统的任意蓝图 ID
-- Issue: v2 蓝图使用如 'geek-arxiv_decoder', 'creator-newsletter' 等新格式 ID
-- ============================================================================

-- Drop the existing constraint
ALTER TABLE synthesis_reports
DROP CONSTRAINT IF EXISTS valid_blueprint_type;

-- Add comment explaining the change
COMMENT ON COLUMN synthesis_reports.blueprint_type IS '蓝图类型: v1 类型(debater, blogger, thread, tutorial, feynman) 或 v2 ID格式(category-name，如 geek-arxiv_decoder)';

-- Add index for the blueprint_type column if not exists
-- This helps with filtering by blueprint type
CREATE INDEX IF NOT EXISTS idx_synthesis_reports_blueprint_type_v2
  ON synthesis_reports(blueprint_type);

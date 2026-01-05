-- ============================================================================
-- Migration: Add Knowledge Studio v1 fields to synthesis_reports
-- Description: 为 synthesis_reports 表添加 Knowledge Studio v1 所需字段
-- Safe: 使用 ADD COLUMN IF NOT EXISTS 避免重复添加
-- ============================================================================

-- ============================================================================
-- 1. ADD MISSING COLUMNS (IF NOT EXISTS)
-- ============================================================================

-- blueprint_type: 蓝图类型 (debater, blogger, thread, tutorial, feynman)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'synthesis_reports' AND column_name = 'blueprint_type'
  ) THEN
    ALTER TABLE synthesis_reports ADD COLUMN blueprint_type TEXT;
  END IF;
END $$;

-- content: 生成内容 (用于 v1 蓝图输出)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'synthesis_reports' AND column_name = 'content'
  ) THEN
    ALTER TABLE synthesis_reports ADD COLUMN content TEXT;
  END IF;
END $$;

-- citations: 引用来源 JSONB 数组
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'synthesis_reports' AND column_name = 'citations'
  ) THEN
    ALTER TABLE synthesis_reports ADD COLUMN citations JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- generation_metadata: 生成元数据
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'synthesis_reports' AND column_name = 'generation_metadata'
  ) THEN
    ALTER TABLE synthesis_reports ADD COLUMN generation_metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- version: 版本号 (用于增量编辑)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'synthesis_reports' AND column_name = 'version'
  ) THEN
    ALTER TABLE synthesis_reports ADD COLUMN version INTEGER DEFAULT 1;
  END IF;
END $$;

-- ============================================================================
-- 2. ADD INDEXES (IF NOT EXISTS)
-- ============================================================================

-- Index for blueprint_type filtering
CREATE INDEX IF NOT EXISTS idx_synthesis_reports_blueprint_type
  ON synthesis_reports(blueprint_type);

-- GIN index for citations JSONB queries
CREATE INDEX IF NOT EXISTS idx_synthesis_reports_citations_gin
  ON synthesis_reports USING GIN (citations);

-- ============================================================================
-- 3. UPDATE COMMENTS
-- ============================================================================

COMMENT ON COLUMN synthesis_reports.blueprint_type IS 'Knowledge Studio v1 蓝图类型: debater, blogger, thread, tutorial, feynman (null for thematic synthesis)';
COMMENT ON COLUMN synthesis_reports.content IS 'Knowledge Studio v1 生成内容 (null for thematic synthesis which uses structured JSONB fields)';
COMMENT ON COLUMN synthesis_reports.citations IS '引用来源 JSONB 数组: [{bookmark_id, title, url, excerpt, position}]';
COMMENT ON COLUMN synthesis_reports.generation_metadata IS '生成元数据: {model, tokens, duration_ms, stages_timing}';
COMMENT ON COLUMN synthesis_reports.version IS '报告版本号，用于增量编辑追踪';

-- ============================================================================
-- 4. ENSURE TRIGGER EXISTS
-- ============================================================================

-- Ensure update_updated_at_column function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_synthesis_reports_updated_at'
  ) THEN
    CREATE TRIGGER update_synthesis_reports_updated_at
      BEFORE UPDATE ON synthesis_reports
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

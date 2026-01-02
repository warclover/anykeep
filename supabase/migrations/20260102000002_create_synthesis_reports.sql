-- ============================================================================
-- Migration: Create synthesis_reports table for Knowledge Studio
-- Description: 写作蓝图合成报告表，支持 5 种蓝图类型和 JSONB 元数据
-- Architecture Reference: Decision 4.1 - JSONB 数据模型
-- ============================================================================

-- Drop existing table if exists (for clean slate)
DROP TABLE IF EXISTS synthesis_reports CASCADE;

-- Create synthesis_reports table
CREATE TABLE synthesis_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Blueprint configuration
  blueprint_type TEXT NOT NULL,
  title TEXT,

  -- Generated content
  content TEXT NOT NULL,

  -- JSONB fields for flexible storage
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  generation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Versioning for future edits
  version INTEGER NOT NULL DEFAULT 1,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraint: Valid blueprint types
  CONSTRAINT valid_blueprint_type CHECK (
    blueprint_type IN ('debater', 'blogger', 'thread', 'tutorial', 'feynman')
  )
);

-- Add table comment
COMMENT ON TABLE synthesis_reports IS 'Knowledge Studio 写作蓝图合成报告表';
COMMENT ON COLUMN synthesis_reports.blueprint_type IS '蓝图类型: debater(辩论家), blogger(博主), thread(推文串), tutorial(教程), feynman(费曼)';
COMMENT ON COLUMN synthesis_reports.citations IS '引用来源 JSONB 数组: [{bookmark_id, title, url, excerpt, position}]';
COMMENT ON COLUMN synthesis_reports.generation_metadata IS '生成元数据: {model, tokens, duration_ms, stages_timing}';

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE synthesis_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own reports
CREATE POLICY "Users can manage own synthesis reports"
  ON synthesis_reports
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Index: User + Created (for listing user's reports by date)
CREATE INDEX idx_synthesis_reports_user_created
  ON synthesis_reports(user_id, created_at DESC);

-- Index: Blueprint type (for filtering by type)
CREATE INDEX idx_synthesis_reports_blueprint_type
  ON synthesis_reports(blueprint_type);

-- Index: GIN index on citations for JSONB queries
CREATE INDEX idx_synthesis_reports_citations_gin
  ON synthesis_reports USING GIN (citations);

-- ============================================================================
-- Trigger: Auto-update updated_at timestamp
-- ============================================================================

-- Create or replace the trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for synthesis_reports
DROP TRIGGER IF EXISTS update_synthesis_reports_updated_at ON synthesis_reports;
CREATE TRIGGER update_synthesis_reports_updated_at
  BEFORE UPDATE ON synthesis_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Migration: Create synthesis_highlights table for user annotations
-- Version: 20251229000002
-- Description: 综述用户标注表，用于存储用户在综述内容上的高亮和备注

-- ============================================================================
-- 1. CREATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS synthesis_highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES synthesis_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 标注内容
  content TEXT NOT NULL,                -- 标注的文字内容
  note TEXT,                            -- 用户备注（可选）
  color TEXT DEFAULT 'yellow',          -- 标注颜色 (yellow, green, blue, pink)

  -- 位置信息
  position JSONB NOT NULL DEFAULT '{}', -- {start: number, end: number, section: string}
  -- section: 'overview' | 'consensus' | 'divergence' | 'blindspot' | 'full'

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

-- 报告查询索引
CREATE INDEX IF NOT EXISTS idx_synthesis_highlights_report_id
  ON synthesis_highlights(report_id);

-- 用户查询索引
CREATE INDEX IF NOT EXISTS idx_synthesis_highlights_user_id
  ON synthesis_highlights(user_id);

-- 复合索引：报告 + 用户 (常用查询)
CREATE INDEX IF NOT EXISTS idx_synthesis_highlights_report_user
  ON synthesis_highlights(report_id, user_id);

-- 创建时间索引（用于排序）
CREATE INDEX IF NOT EXISTS idx_synthesis_highlights_created_at
  ON synthesis_highlights(created_at DESC);

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE synthesis_highlights ENABLE ROW LEVEL SECURITY;

-- 查看自己的标注
CREATE POLICY "Users can view own synthesis highlights"
  ON synthesis_highlights
  FOR SELECT
  USING (auth.uid() = user_id);

-- 创建自己的标注
CREATE POLICY "Users can create own synthesis highlights"
  ON synthesis_highlights
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 更新自己的标注
CREATE POLICY "Users can update own synthesis highlights"
  ON synthesis_highlights
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 删除自己的标注
CREATE POLICY "Users can delete own synthesis highlights"
  ON synthesis_highlights
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4. TRIGGERS
-- ============================================================================

-- 自动更新 updated_at 时间戳
CREATE OR REPLACE FUNCTION update_synthesis_highlights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_synthesis_highlights_updated_at
  BEFORE UPDATE ON synthesis_highlights
  FOR EACH ROW
  EXECUTE FUNCTION update_synthesis_highlights_updated_at();

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON TABLE synthesis_highlights IS '综述用户标注表 - 存储用户在综述内容上的高亮和备注';

COMMENT ON COLUMN synthesis_highlights.content IS '标注的文字内容';
COMMENT ON COLUMN synthesis_highlights.note IS '用户添加的个人备注';
COMMENT ON COLUMN synthesis_highlights.color IS '标注颜色: yellow(默认), green, blue, pink';
COMMENT ON COLUMN synthesis_highlights.position IS '位置信息 JSON: {start: 起始偏移, end: 结束偏移, section: 所在区块}';

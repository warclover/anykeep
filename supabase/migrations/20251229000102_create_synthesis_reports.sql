-- Migration: Create synthesis_reports table for Thematic Synthesizer feature
-- Version: 20251229000001
-- Description: 主题合成器综述报告存储表

-- ============================================================================
-- 1. CREATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS synthesis_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 基础信息
  title TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('folder', 'tag', 'selection', 'ai_recommend')),
  source_id UUID,                    -- folder_id 或 tag_id (when source_type is 'folder' or 'tag')
  source_bookmark_ids UUID[],        -- 手动选择的书签 ID 列表 (when source_type is 'selection')
  depth_mode TEXT NOT NULL DEFAULT 'standard' CHECK (depth_mode IN ('quick', 'standard', 'academic')),

  -- 四维结构化输出
  overview TEXT,                     -- 概述
  consensus JSONB DEFAULT '[]',      -- [{point: string, confidence: number, sources: [{id, title, quote?}]}]
  divergence JSONB DEFAULT '[]',     -- [{topic, point_a, sources_a, point_b, sources_b, analysis}]
  blind_spots JSONB DEFAULT '[]',    -- [{topic, suggestion, search_keywords, related_bookmarks?}]

  -- 完整输出
  full_markdown TEXT,                -- 完整 Markdown 文本

  -- 向量与搜索
  embedding vector(1536),            -- 综述内容向量 (for semantic search)

  -- 状态与元数据
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  error_message TEXT,                -- 错误信息 (when status is 'failed')
  source_count INTEGER DEFAULT 0,    -- 参与合成的书签数量
  word_count INTEGER DEFAULT 0,      -- 生成字数

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ           -- 完成时间 (when status becomes 'completed')
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

-- 用户查询索引
CREATE INDEX IF NOT EXISTS idx_synthesis_reports_user_id
  ON synthesis_reports(user_id);

-- 状态筛选索引
CREATE INDEX IF NOT EXISTS idx_synthesis_reports_status
  ON synthesis_reports(status);

-- 来源类型筛选索引
CREATE INDEX IF NOT EXISTS idx_synthesis_reports_source_type
  ON synthesis_reports(source_type);

-- 时间排序索引
CREATE INDEX IF NOT EXISTS idx_synthesis_reports_created_at
  ON synthesis_reports(created_at DESC);

-- 复合索引：用户 + 状态 (常用查询)
CREATE INDEX IF NOT EXISTS idx_synthesis_reports_user_status
  ON synthesis_reports(user_id, status);

-- 向量相似度搜索索引 (HNSW for better performance)
CREATE INDEX IF NOT EXISTS idx_synthesis_reports_embedding
  ON synthesis_reports USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE synthesis_reports ENABLE ROW LEVEL SECURITY;

-- 查看自己的报告
CREATE POLICY "Users can view own synthesis reports"
  ON synthesis_reports
  FOR SELECT
  USING (auth.uid() = user_id);

-- 创建自己的报告
CREATE POLICY "Users can create own synthesis reports"
  ON synthesis_reports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 更新自己的报告
CREATE POLICY "Users can update own synthesis reports"
  ON synthesis_reports
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 删除自己的报告
CREATE POLICY "Users can delete own synthesis reports"
  ON synthesis_reports
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4. TRIGGERS
-- ============================================================================

-- 自动更新 updated_at 时间戳
CREATE OR REPLACE FUNCTION update_synthesis_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_synthesis_reports_updated_at
  BEFORE UPDATE ON synthesis_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_synthesis_reports_updated_at();

-- 状态变更为 completed 时自动设置 completed_at
CREATE OR REPLACE FUNCTION set_synthesis_reports_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_synthesis_reports_completed_at
  BEFORE UPDATE ON synthesis_reports
  FOR EACH ROW
  EXECUTE FUNCTION set_synthesis_reports_completed_at();

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON TABLE synthesis_reports IS '主题合成器综述报告表 - 存储多源内容综述结果';

COMMENT ON COLUMN synthesis_reports.source_type IS '来源类型: folder(文件夹), tag(标签), selection(手动选择), ai_recommend(AI推荐)';
COMMENT ON COLUMN synthesis_reports.depth_mode IS '综述深度: quick(快读3-5句), standard(标准500-800字), academic(学术1500+字)';
COMMENT ON COLUMN synthesis_reports.consensus IS '核心共识点 JSON 数组';
COMMENT ON COLUMN synthesis_reports.divergence IS '观点分歧点 JSON 数组';
COMMENT ON COLUMN synthesis_reports.blind_spots IS '知识盲区 JSON 数组';
COMMENT ON COLUMN synthesis_reports.embedding IS '综述内容的向量嵌入，用于语义搜索';

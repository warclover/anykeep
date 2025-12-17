-- Migration: 20251220000001_create_md_collections.sql
-- P2-007: Markdown 内容收藏功能
-- 创建独立的 MD 收藏表（与 bookmarks 表完全解耦）

-- ============================================
-- 1. 创建 md_collections 表
-- ============================================
CREATE TABLE IF NOT EXISTS md_collections (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 基础信息
  title VARCHAR(500) NOT NULL,
  raw_content TEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,  -- SHA-256 去重

  -- 元数据
  word_count INTEGER DEFAULT 0,
  code_block_count INTEGER DEFAULT 0,
  reading_time_minutes INTEGER DEFAULT 0,

  -- AI 生成内容
  ai_summary TEXT,
  ai_tags TEXT[],
  content_type VARCHAR(50),           -- TUTORIAL, CODE_SNIPPET, ANALYSIS 等
  content_type_confidence REAL,

  -- 向量嵌入（1024 维，与 bookmarks 表一致）
  embedding vector(1024),
  embedding_version TEXT DEFAULT 'v3', -- 向量模型版本追踪

  -- 组织
  folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL,
  user_tags TEXT[],
  notes TEXT,

  -- 状态
  processing_status VARCHAR(20) DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================
-- 2. 创建索引
-- ============================================

-- 用户索引
CREATE INDEX idx_md_collections_user_id ON md_collections(user_id)
  WHERE deleted_at IS NULL;

-- 内容哈希索引（用于去重）
CREATE INDEX idx_md_collections_content_hash ON md_collections(user_id, content_hash)
  WHERE deleted_at IS NULL;

-- 文件夹索引
CREATE INDEX idx_md_collections_folder ON md_collections(folder_id)
  WHERE deleted_at IS NULL;

-- 创建时间索引
CREATE INDEX idx_md_collections_created ON md_collections(created_at DESC)
  WHERE deleted_at IS NULL;

-- 处理状态索引
CREATE INDEX idx_md_collections_status ON md_collections(processing_status)
  WHERE deleted_at IS NULL;

-- 向量索引（使用 HNSW 算法，与 bookmarks 表一致）
CREATE INDEX idx_md_collections_embedding_hnsw ON md_collections
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)
  WHERE deleted_at IS NULL AND embedding IS NOT NULL;

-- ============================================
-- 3. RLS 策略
-- ============================================
ALTER TABLE md_collections ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的 MD 收藏
CREATE POLICY "Users can view own md_collections"
  ON md_collections FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能创建自己的 MD 收藏
CREATE POLICY "Users can create own md_collections"
  ON md_collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的 MD 收藏
CREATE POLICY "Users can update own md_collections"
  ON md_collections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 用户只能删除自己的 MD 收藏
CREATE POLICY "Users can delete own md_collections"
  ON md_collections FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 4. 触发器：更新时间戳
-- ============================================
CREATE TRIGGER update_md_collections_updated_at
  BEFORE UPDATE ON md_collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. 语义搜索函数
-- ============================================
CREATE OR REPLACE FUNCTION search_md_collections_semantic(
  query_embedding vector(1024),
  p_user_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 20
)
RETURNS TABLE (
  id BIGINT,
  title VARCHAR(500),
  ai_summary TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mc.id,
    mc.title,
    mc.ai_summary,
    1 - (mc.embedding <=> query_embedding) AS similarity
  FROM md_collections mc
  WHERE mc.user_id = p_user_id
    AND mc.deleted_at IS NULL
    AND mc.embedding IS NOT NULL
    AND 1 - (mc.embedding <=> query_embedding) > match_threshold
  ORDER BY mc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- 6. 添加注释
-- ============================================
COMMENT ON TABLE md_collections IS 'Markdown 内容收藏表（P2-007 功能，与 bookmarks 完全解耦）';
COMMENT ON COLUMN md_collections.raw_content IS 'Markdown 原始内容';
COMMENT ON COLUMN md_collections.content_hash IS 'SHA-256 哈希，用于去重';
COMMENT ON COLUMN md_collections.embedding IS '1024 维向量嵌入，用于语义搜索';
COMMENT ON COLUMN md_collections.embedding_version IS '向量模型版本（v3 = 1024 维）';
COMMENT ON COLUMN md_collections.processing_status IS 'AI 处理状态：pending/processing/completed/failed';

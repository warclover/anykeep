/**
 * 智能分类 v5.0 - Context Anchor（上下文锚点）
 *
 * 功能说明：
 * - 提取书签的上下文锚点（系列文章、作者、来源等）
 * - 将相似上下文的书签关联到同一锚点
 * - 在分类时参考同一锚点下其他书签的分类情况
 */

-- =====================================================
-- 1. 创建 context_anchors 表
-- =====================================================

CREATE TABLE IF NOT EXISTS context_anchors (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 锚点类型：series(系列), author(作者), source(来源), topic(主题)
  anchor_type VARCHAR(20) NOT NULL CHECK (anchor_type IN ('series', 'author', 'source', 'topic')),

  -- 锚点名称（如系列名、作者名等）
  anchor_name VARCHAR(255) NOT NULL,

  -- 锚点元数据（存储额外信息，如 URL、描述等）
  anchor_metadata JSONB DEFAULT '{}'::jsonb,

  -- 向量嵌入（用于相似度匹配）
  embedding vector(1024),

  -- 关联的书签数量
  bookmark_count INTEGER DEFAULT 0,

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 唯一约束：同一用户的同一类型+名称的锚点唯一
  UNIQUE(user_id, anchor_type, anchor_name)
);

-- 索引优化
CREATE INDEX idx_context_anchors_user_id ON context_anchors(user_id);
CREATE INDEX idx_context_anchors_type ON context_anchors(anchor_type);
CREATE INDEX idx_context_anchors_embedding ON context_anchors USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- RLS 策略
ALTER TABLE context_anchors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own context anchors"
  ON context_anchors FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own context anchors"
  ON context_anchors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own context anchors"
  ON context_anchors FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own context anchors"
  ON context_anchors FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 2. 扩展 bookmarks 表
-- =====================================================

-- 添加 context_anchor_id 外键
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS context_anchor_id BIGINT REFERENCES context_anchors(id) ON DELETE SET NULL;

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_bookmarks_context_anchor_id ON bookmarks(context_anchor_id);

-- =====================================================
-- 3. 触发器：自动更新 bookmark_count
-- =====================================================

-- 当书签关联到锚点时，增加计数
CREATE OR REPLACE FUNCTION increment_anchor_bookmark_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.context_anchor_id IS NOT NULL THEN
    UPDATE context_anchors
    SET bookmark_count = bookmark_count + 1,
        updated_at = NOW()
    WHERE id = NEW.context_anchor_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 当书签取消关联时，减少计数
CREATE OR REPLACE FUNCTION decrement_anchor_bookmark_count()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.context_anchor_id IS NOT NULL THEN
    UPDATE context_anchors
    SET bookmark_count = bookmark_count - 1,
        updated_at = NOW()
    WHERE id = OLD.context_anchor_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 当书签更新关联时，调整计数
CREATE OR REPLACE FUNCTION update_anchor_bookmark_count()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果锚点发生变化
  IF OLD.context_anchor_id IS DISTINCT FROM NEW.context_anchor_id THEN
    -- 减少旧锚点的计数
    IF OLD.context_anchor_id IS NOT NULL THEN
      UPDATE context_anchors
      SET bookmark_count = bookmark_count - 1,
          updated_at = NOW()
      WHERE id = OLD.context_anchor_id;
    END IF;

    -- 增加新锚点的计数
    IF NEW.context_anchor_id IS NOT NULL THEN
      UPDATE context_anchors
      SET bookmark_count = bookmark_count + 1,
          updated_at = NOW()
      WHERE id = NEW.context_anchor_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器
CREATE TRIGGER trigger_increment_anchor_bookmark_count
  AFTER INSERT ON bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION increment_anchor_bookmark_count();

CREATE TRIGGER trigger_decrement_anchor_bookmark_count
  AFTER DELETE ON bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION decrement_anchor_bookmark_count();

CREATE TRIGGER trigger_update_anchor_bookmark_count
  AFTER UPDATE OF context_anchor_id ON bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION update_anchor_bookmark_count();

-- =====================================================
-- 4. RPC 函数：查找相似的上下文锚点
-- =====================================================

CREATE OR REPLACE FUNCTION find_similar_context_anchors(
  p_embedding vector(1024),
  p_anchor_type VARCHAR(20) DEFAULT NULL,
  p_limit INTEGER DEFAULT 5,
  p_threshold DECIMAL(3,2) DEFAULT 0.7
)
RETURNS TABLE (
  anchor_id BIGINT,
  anchor_type VARCHAR(20),
  anchor_name VARCHAR(255),
  anchor_metadata JSONB,
  bookmark_count INTEGER,
  similarity DECIMAL(5,4)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ca.id,
    ca.anchor_type,
    ca.anchor_name,
    ca.anchor_metadata,
    ca.bookmark_count,
    (1 - (ca.embedding <=> p_embedding))::DECIMAL(5,4) AS similarity
  FROM context_anchors ca
  WHERE ca.user_id = auth.uid()
    AND (p_anchor_type IS NULL OR ca.anchor_type = p_anchor_type)
    AND (1 - (ca.embedding <=> p_embedding)) >= p_threshold
  ORDER BY ca.embedding <=> p_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

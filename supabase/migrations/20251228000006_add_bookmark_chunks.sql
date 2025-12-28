-- ============================================
-- Parent-Child 切片表
-- 支持长文档的精准段落检索
-- ============================================

-- 切片表
CREATE TABLE IF NOT EXISTS public.bookmark_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bookmark_id BIGINT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  parent_chunk_id UUID REFERENCES bookmark_chunks(id) ON DELETE CASCADE,

  -- 切片内容
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL, -- 用于去重

  -- 切片元数据
  chunk_type VARCHAR(20) DEFAULT 'child' CHECK (chunk_type IN ('parent', 'child')),
  token_count INT NOT NULL,
  start_offset INT, -- 在原文中的起始位置
  end_offset INT,   -- 在原文中的结束位置

  -- 向量嵌入 (1024 维，与当前 embedding 模型一致)
  embedding VECTOR(1024),
  embedding_version VARCHAR(20),

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 约束
  CONSTRAINT unique_chunk_index UNIQUE (bookmark_id, chunk_index)
);

-- 添加注释
COMMENT ON TABLE public.bookmark_chunks IS 'Parent-Child 切片表，用于长文档精准检索';
COMMENT ON COLUMN public.bookmark_chunks.chunk_type IS '切片类型: parent-完整段落, child-小块用于检索';
COMMENT ON COLUMN public.bookmark_chunks.content_hash IS '内容哈希，用于去重检测';
COMMENT ON COLUMN public.bookmark_chunks.parent_chunk_id IS '父切片ID，child类型指向其parent';
COMMENT ON COLUMN public.bookmark_chunks.embedding IS '1024维向量嵌入';

-- HNSW 向量索引 (优化检索性能)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON bookmark_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 查询优化索引
CREATE INDEX IF NOT EXISTS idx_chunks_bookmark_id ON bookmark_chunks(bookmark_id);
CREATE INDEX IF NOT EXISTS idx_chunks_parent_id ON bookmark_chunks(parent_chunk_id) WHERE parent_chunk_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chunks_type ON bookmark_chunks(chunk_type);
CREATE INDEX IF NOT EXISTS idx_chunks_content_hash ON bookmark_chunks(content_hash);

-- 启用 RLS
ALTER TABLE public.bookmark_chunks ENABLE ROW LEVEL SECURITY;

-- RLS 策略: 用户只能查看自己书签的切片
CREATE POLICY "Users can view their own chunks" ON bookmark_chunks
  FOR SELECT
  USING (bookmark_id IN (
    SELECT id FROM bookmarks WHERE user_id = auth.uid()
  ));

-- RLS 策略: 服务角色可以管理所有切片
CREATE POLICY "Service role can manage all chunks" ON bookmark_chunks
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 切片向量搜索函数
-- ============================================

CREATE OR REPLACE FUNCTION search_bookmark_chunks(
  query_embedding VECTOR(1024),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 20,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (
  chunk_id UUID,
  bookmark_id BIGINT,
  chunk_content TEXT,
  chunk_type VARCHAR(20),
  chunk_index INT,
  parent_content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS chunk_id,
    c.bookmark_id,
    c.content AS chunk_content,
    c.chunk_type,
    c.chunk_index,
    COALESCE(p.content, c.content) AS parent_content, -- 返回 parent 上下文
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM bookmark_chunks c
  LEFT JOIN bookmark_chunks p ON c.parent_chunk_id = p.id
  JOIN bookmarks b ON c.bookmark_id = b.id
  WHERE b.user_id = p_user_id
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION search_bookmark_chunks IS 'Parent-Child 切片向量搜索，返回匹配的切片及其父上下文';

-- ============================================
-- 切片统计函数
-- ============================================

CREATE OR REPLACE FUNCTION get_chunk_stats(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  total_chunks BIGINT,
  parent_chunks BIGINT,
  child_chunks BIGINT,
  bookmarks_with_chunks BIGINT,
  avg_chunks_per_bookmark FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(c.id)::BIGINT AS total_chunks,
    COUNT(c.id) FILTER (WHERE c.chunk_type = 'parent')::BIGINT AS parent_chunks,
    COUNT(c.id) FILTER (WHERE c.chunk_type = 'child')::BIGINT AS child_chunks,
    COUNT(DISTINCT c.bookmark_id)::BIGINT AS bookmarks_with_chunks,
    CASE
      WHEN COUNT(DISTINCT c.bookmark_id) > 0
      THEN COUNT(c.id)::FLOAT / COUNT(DISTINCT c.bookmark_id)::FLOAT
      ELSE 0
    END AS avg_chunks_per_bookmark
  FROM bookmark_chunks c
  JOIN bookmarks b ON c.bookmark_id = b.id
  WHERE b.user_id = p_user_id;
END;
$$;

COMMENT ON FUNCTION get_chunk_stats IS '获取用户的切片统计信息';

-- ============================================
-- 删除书签时自动清理切片的触发器
-- ============================================

-- 注意：由于已设置 ON DELETE CASCADE，无需额外触发器

-- ============================================
-- 更新时间戳触发器
-- ============================================

CREATE OR REPLACE FUNCTION update_chunk_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_chunk_timestamp
  BEFORE UPDATE ON bookmark_chunks
  FOR EACH ROW
  EXECUTE FUNCTION update_chunk_updated_at();

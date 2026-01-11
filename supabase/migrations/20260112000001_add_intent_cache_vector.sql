-- ============================================
-- AI 意图缓存语义增强 - Phase 2
--
-- 版本: 1.0.0
-- 创建日期: 2026-01-12
-- 说明: 为意图缓存添加向量嵌入支持，实现语义匹配缓存
-- ============================================

-- 1. 添加向量嵌入字段到 ai_intent_cache 表
ALTER TABLE ai_intent_cache
ADD COLUMN IF NOT EXISTS message_embedding vector(1024);

-- 2. 添加原始消息字段（用于调试和分析）
ALTER TABLE ai_intent_cache
ADD COLUMN IF NOT EXISTS original_message TEXT;

-- 3. 添加更新时间戳
ALTER TABLE ai_intent_cache
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4. 创建 HNSW 向量索引（高性能近似最近邻搜索）
-- m=16: 每个节点的最大连接数
-- ef_construction=64: 构建时的搜索宽度
CREATE INDEX IF NOT EXISTS idx_ai_intent_cache_embedding
  ON ai_intent_cache
  USING hnsw (message_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 5. 创建复合索引优化过期检查
CREATE INDEX IF NOT EXISTS idx_ai_intent_cache_expires_embedding
  ON ai_intent_cache (expires_at)
  WHERE message_embedding IS NOT NULL
    AND expires_at > NOW();

-- 6. 添加触发器自动更新 updated_at
CREATE OR REPLACE FUNCTION update_ai_intent_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_intent_cache_updated_at ON ai_intent_cache;
CREATE TRIGGER trg_ai_intent_cache_updated_at
  BEFORE UPDATE ON ai_intent_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_intent_cache_updated_at();

-- 7. 向量相似度搜索函数
CREATE OR REPLACE FUNCTION match_intent_cache_semantic(
  query_embedding vector(1024),
  similarity_threshold float DEFAULT 0.95,
  match_count int DEFAULT 1
)
RETURNS TABLE (
  id BIGINT,
  input_hash VARCHAR(64),
  normalized_input TEXT,
  original_message TEXT,
  intent_type VARCHAR(50),
  intent_subtype VARCHAR(50),
  confidence DECIMAL(5,4),
  method VARCHAR(20),
  slots JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ic.id,
    ic.input_hash,
    ic.normalized_input,
    ic.original_message,
    ic.intent_type,
    ic.intent_subtype,
    ic.confidence,
    ic.method,
    ic.slots,
    1 - (ic.message_embedding <=> query_embedding) AS similarity
  FROM ai_intent_cache ic
  WHERE
    ic.message_embedding IS NOT NULL
    AND (ic.expires_at IS NULL OR ic.expires_at > NOW())
    AND 1 - (ic.message_embedding <=> query_embedding) >= similarity_threshold
  ORDER BY ic.message_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 8. 批量写入语义缓存（带去重逻辑）
CREATE OR REPLACE FUNCTION upsert_intent_cache_semantic(
  p_input_hash VARCHAR(64),
  p_normalized_input TEXT,
  p_original_message TEXT,
  p_intent_type VARCHAR(50),
  p_intent_subtype VARCHAR(50),
  p_confidence DECIMAL(5,4),
  p_method VARCHAR(20),
  p_slots JSONB,
  p_message_embedding vector(1024),
  p_ttl_days INTEGER DEFAULT 7
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_id BIGINT;
  new_expires_at TIMESTAMPTZ;
BEGIN
  new_expires_at := NOW() + (p_ttl_days || ' days')::INTERVAL;

  INSERT INTO ai_intent_cache (
    input_hash,
    normalized_input,
    original_message,
    intent_type,
    intent_subtype,
    confidence,
    method,
    slots,
    message_embedding,
    expires_at,
    hit_count
  ) VALUES (
    p_input_hash,
    p_normalized_input,
    p_original_message,
    p_intent_type,
    p_intent_subtype,
    p_confidence,
    p_method,
    p_slots,
    p_message_embedding,
    new_expires_at,
    0
  )
  ON CONFLICT (input_hash) DO UPDATE SET
    normalized_input = EXCLUDED.normalized_input,
    original_message = EXCLUDED.original_message,
    intent_type = EXCLUDED.intent_type,
    intent_subtype = EXCLUDED.intent_subtype,
    confidence = EXCLUDED.confidence,
    method = EXCLUDED.method,
    slots = EXCLUDED.slots,
    message_embedding = EXCLUDED.message_embedding,
    expires_at = new_expires_at,
    updated_at = NOW()
  RETURNING id INTO result_id;

  RETURN result_id;
END;
$$;

-- 9. 更新命中统计（增强版，支持语义缓存）
CREATE OR REPLACE FUNCTION increment_intent_cache_hit(p_cache_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE ai_intent_cache
  SET
    hit_count = hit_count + 1,
    last_hit_at = NOW()
  WHERE id = p_cache_id
    AND (expires_at IS NULL OR expires_at > NOW());
END;
$$;

-- 10. 获取热门缓存条目（用于预热）
CREATE OR REPLACE FUNCTION get_top_intent_cache_entries(
  top_k INTEGER DEFAULT 100
)
RETURNS TABLE (
  id BIGINT,
  input_hash VARCHAR(64),
  normalized_input TEXT,
  intent_type VARCHAR(50),
  intent_subtype VARCHAR(50),
  confidence DECIMAL(5,4),
  hit_count INTEGER,
  message_embedding vector(1024)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ic.id,
    ic.input_hash,
    ic.normalized_input,
    ic.intent_type,
    ic.intent_subtype,
    ic.confidence,
    ic.hit_count,
    ic.message_embedding
  FROM ai_intent_cache ic
  WHERE
    ic.message_embedding IS NOT NULL
    AND (ic.expires_at IS NULL OR ic.expires_at > NOW())
  ORDER BY ic.hit_count DESC
  LIMIT top_k;
END;
$$;

-- 11. 缓存统计函数
CREATE OR REPLACE FUNCTION get_intent_cache_stats()
RETURNS TABLE (
  total_count BIGINT,
  with_embedding_count BIGINT,
  expired_count BIGINT,
  total_hits BIGINT,
  avg_confidence DECIMAL(5,4),
  cache_types JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_count,
    COUNT(*) FILTER (WHERE message_embedding IS NOT NULL)::BIGINT as with_embedding_count,
    COUNT(*) FILTER (WHERE expires_at < NOW())::BIGINT as expired_count,
    COALESCE(SUM(hit_count), 0)::BIGINT as total_hits,
    COALESCE(AVG(confidence), 0)::DECIMAL(5,4) as avg_confidence,
    (
      SELECT jsonb_object_agg(method, cnt)
      FROM (
        SELECT method, COUNT(*) as cnt
        FROM ai_intent_cache
        WHERE expires_at IS NULL OR expires_at > NOW()
        GROUP BY method
      ) method_counts
    ) as cache_types
  FROM ai_intent_cache;
END;
$$;

-- 添加注释
COMMENT ON COLUMN ai_intent_cache.message_embedding IS '消息向量嵌入 (1024维)，用于语义相似度匹配';
COMMENT ON COLUMN ai_intent_cache.original_message IS '原始用户消息（未规范化），用于调试';
COMMENT ON COLUMN ai_intent_cache.updated_at IS '最后更新时间';

COMMENT ON FUNCTION match_intent_cache_semantic IS '语义相似度搜索，返回相似度高于阈值的缓存条目';
COMMENT ON FUNCTION upsert_intent_cache_semantic IS '写入或更新语义缓存，支持向量嵌入';
COMMENT ON FUNCTION increment_intent_cache_hit IS '递增缓存命中计数（按 ID）';
COMMENT ON FUNCTION get_top_intent_cache_entries IS '获取热门缓存条目，用于预热';
COMMENT ON FUNCTION get_intent_cache_stats IS '获取缓存统计信息';

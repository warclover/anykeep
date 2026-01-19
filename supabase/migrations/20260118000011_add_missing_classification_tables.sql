-- ============================================
-- Classification v5.0 - 缺失的数据表
-- 创建日期: 2026-01-18
-- 说明: 添加用户规则表、分类日志表、上下文锚点表
-- ============================================

-- ============================================
-- 表 1: 用户自定义分类规则表
-- ============================================
CREATE TABLE IF NOT EXISTS user_classification_rules (
  -- 主键
  id BIGSERIAL PRIMARY KEY,

  -- 用户ID
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 规则类型
  type TEXT NOT NULL, -- 'positive' | 'negative'

  -- 匹配模式
  pattern TEXT NOT NULL,
  pattern_type TEXT NOT NULL, -- 'keyword' | 'regex' | 'domain'

  -- 目标文件夹
  target_folder_id BIGINT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  target_folder_name TEXT NOT NULL,

  -- 优先级（数值越大优先级越高）
  priority INTEGER NOT NULL DEFAULT 100,

  -- 规则来源
  source_text TEXT, -- 用户原始输入文本
  description TEXT, -- 规则描述

  -- 状态
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- 统计信息
  match_count INTEGER NOT NULL DEFAULT 0,

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 添加表注释
COMMENT ON TABLE user_classification_rules IS '智能分类 v5.0 - 用户自定义分类规则表';
COMMENT ON COLUMN user_classification_rules.type IS '规则类型：positive（正向规则）、negative（负向规则）';
COMMENT ON COLUMN user_classification_rules.pattern_type IS '模式类型：keyword（关键词）、regex（正则表达式）、domain（域名）';
COMMENT ON COLUMN user_classification_rules.priority IS '优先级（数值越大优先级越高），默认100';
COMMENT ON COLUMN user_classification_rules.match_count IS '规则匹配次数统计';

-- 索引
CREATE INDEX IF NOT EXISTS user_classification_rules_user_id_idx
  ON user_classification_rules(user_id);

CREATE INDEX IF NOT EXISTS user_classification_rules_active_priority_idx
  ON user_classification_rules(user_id, priority DESC)
  WHERE is_active = TRUE;

-- RLS 策略
ALTER TABLE user_classification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户只能访问自己的分类规则"
  ON user_classification_rules
  FOR ALL
  USING (auth.uid() = user_id);

-- 触发器（自动更新 updated_at）
CREATE TRIGGER update_user_classification_rules_updated_at
  BEFORE UPDATE ON user_classification_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 表 2: 分类日志表
-- ============================================
CREATE TABLE IF NOT EXISTS classification_logs (
  -- 主键
  id BIGSERIAL PRIMARY KEY,

  -- 用户ID
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 书签ID
  bookmark_id BIGINT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,

  -- 建议的分类结果
  suggested_folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL,
  suggested_folder_name TEXT,
  suggested_confidence DECIMAL(3,2),

  -- 实际的分类结果
  actual_folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL,
  actual_folder_name TEXT,

  -- 反馈类型
  feedback_type TEXT NOT NULL, -- 'accept' | 'reject' | 'modify'

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 添加表注释
COMMENT ON TABLE classification_logs IS '智能分类 v5.0 - 分类日志表（记录用户反馈）';
COMMENT ON COLUMN classification_logs.feedback_type IS '反馈类型：accept（接受建议）、reject（拒绝建议）、modify（修改建议）';

-- 索引
CREATE INDEX IF NOT EXISTS classification_logs_user_id_idx
  ON classification_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS classification_logs_bookmark_id_idx
  ON classification_logs(bookmark_id);

-- RLS 策略
ALTER TABLE classification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户只能访问自己的分类日志"
  ON classification_logs
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- 表 3: 上下文锚点表
-- ============================================
CREATE TABLE IF NOT EXISTS context_anchors (
  -- 主键
  id BIGSERIAL PRIMARY KEY,

  -- 用户ID
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 锚点类型
  anchor_type TEXT NOT NULL, -- 'domain' | 'author' | 'topic' | 'tag'

  -- 锚点名称
  anchor_name TEXT NOT NULL,

  -- 锚点元数据
  anchor_metadata JSONB,

  -- 向量嵌入
  embedding vector(1024),

  -- 统计信息
  bookmark_count INTEGER NOT NULL DEFAULT 0,

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 唯一约束
  UNIQUE(user_id, anchor_type, anchor_name)
);

-- 添加表注释
COMMENT ON TABLE context_anchors IS '智能分类 v5.0 - 上下文锚点表（用于提取和匹配书签的上下文特征）';
COMMENT ON COLUMN context_anchors.anchor_type IS '锚点类型：domain（域名）、author（作者）、topic（主题）、tag（标签）';
COMMENT ON COLUMN context_anchors.bookmark_count IS '关联的书签数量';

-- 索引
CREATE INDEX IF NOT EXISTS context_anchors_user_id_idx
  ON context_anchors(user_id);

CREATE INDEX IF NOT EXISTS context_anchors_type_name_idx
  ON context_anchors(user_id, anchor_type, anchor_name);

-- 向量索引
CREATE INDEX IF NOT EXISTS context_anchors_embedding_idx
  ON context_anchors
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- RLS 策略
ALTER TABLE context_anchors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户只能访问自己的上下文锚点"
  ON context_anchors
  FOR ALL
  USING (auth.uid() = user_id);

-- 触发器（自动更新 updated_at）
CREATE TRIGGER update_context_anchors_updated_at
  BEFORE UPDATE ON context_anchors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RPC 函数
-- ============================================

-- 函数 1: 增加规则匹配计数
CREATE OR REPLACE FUNCTION increment_rule_match_count(
  p_rule_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_classification_rules
  SET match_count = match_count + 1,
      updated_at = NOW()
  WHERE id = p_rule_id
    AND user_id = auth.uid();
END;
$$;

COMMENT ON FUNCTION increment_rule_match_count IS '增加用户规则的匹配计数';

-- 函数 2: 查找相似的上下文锚点
CREATE OR REPLACE FUNCTION find_similar_context_anchors(
  p_user_id UUID,
  p_query_embedding vector(1024),
  p_similarity_threshold FLOAT,
  p_limit INT
)
RETURNS TABLE (
  anchor_id BIGINT,
  anchor_type TEXT,
  anchor_name TEXT,
  anchor_metadata JSONB,
  bookmark_count INTEGER,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ca.id AS anchor_id,
    ca.anchor_type,
    ca.anchor_name,
    ca.anchor_metadata,
    ca.bookmark_count,
    1 - (ca.embedding <=> p_query_embedding) AS similarity
  FROM context_anchors ca
  WHERE ca.user_id = p_user_id
    AND ca.embedding IS NOT NULL
    AND 1 - (ca.embedding <=> p_query_embedding) > p_similarity_threshold
  ORDER BY similarity DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION find_similar_context_anchors IS '查找相似的上下文锚点（基于向量相似度）';

-- 函数 3: 计算文件夹熵值
CREATE OR REPLACE FUNCTION calculate_folder_entropy(
  p_folder_id BIGINT
)
RETURNS TABLE (
  entropy_score DECIMAL,
  bookmark_count INTEGER,
  avg_similarity DECIMAL,
  similarity_stddev DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_bookmark_count INTEGER;
  v_avg_similarity DECIMAL;
  v_stddev_similarity DECIMAL;
  v_entropy_score DECIMAL;
BEGIN
  -- 获取文件夹所属用户
  SELECT user_id INTO v_user_id
  FROM folders
  WHERE id = p_folder_id;

  -- 验证权限
  IF v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized access to folder';
  END IF;

  -- 计算书签数量
  SELECT COUNT(*) INTO v_bookmark_count
  FROM bookmarks
  WHERE folder_id = p_folder_id
    AND user_id = v_user_id;

  -- 如果书签数量小于2，无法计算熵值
  IF v_bookmark_count < 2 THEN
    RETURN QUERY SELECT 0::DECIMAL, v_bookmark_count, 0::DECIMAL, 0::DECIMAL;
    RETURN;
  END IF;

  -- 计算书签之间的平均相似度和标准差
  WITH similarities AS (
    SELECT
      1 - (b1.embedding <=> b2.embedding) AS similarity
    FROM bookmarks b1
    CROSS JOIN bookmarks b2
    WHERE b1.folder_id = p_folder_id
      AND b2.folder_id = p_folder_id
      AND b1.id < b2.id
      AND b1.embedding IS NOT NULL
      AND b2.embedding IS NOT NULL
      AND b1.user_id = v_user_id
      AND b2.user_id = v_user_id
  )
  SELECT
    AVG(similarity)::DECIMAL,
    STDDEV(similarity)::DECIMAL
  INTO v_avg_similarity, v_stddev_similarity
  FROM similarities;

  -- 计算熵值（相似度越低，熵值越高）
  v_entropy_score := COALESCE(1 - v_avg_similarity, 0);

  RETURN QUERY SELECT
    v_entropy_score,
    v_bookmark_count,
    COALESCE(v_avg_similarity, 0::DECIMAL),
    COALESCE(v_stddev_similarity, 0::DECIMAL);
END;
$$;

COMMENT ON FUNCTION calculate_folder_entropy IS '计算文件夹的熵值（基于书签向量相似度）';

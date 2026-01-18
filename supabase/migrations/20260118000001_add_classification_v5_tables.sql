-- ============================================
-- Classification v5.0 数据表
-- 创建日期: 2026-01-18
-- 说明: 智能分类 v5.0 核心数据表、索引、RLS 策略
-- ============================================

-- 启用 pgvector 扩展（如果尚未启用）
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 表 1: 文件夹画像表（双源向量 + 动态 α）
-- ============================================
CREATE TABLE IF NOT EXISTS classification_folder_profiles_v5 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id BIGINT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,

  -- 双源向量
  content_embedding vector(1024) NOT NULL,     -- 内容向量（OpenAI text-embedding-3-small）
  behavior_embedding vector(1024) NOT NULL,    -- 行为向量

  -- 动态 α 系数
  alpha_coefficient DECIMAL(3,2) NOT NULL DEFAULT 0.50,

  -- 懒更新元数据
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bookmark_count INTEGER NOT NULL DEFAULT 0,
  needs_update BOOLEAN NOT NULL DEFAULT FALSE,

  -- 统计信息
  avg_classification_score DECIMAL(3,2),
  total_classifications INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, folder_id)
);

-- 添加表注释
COMMENT ON TABLE classification_folder_profiles_v5 IS '智能分类 v5.0 - 文件夹画像表（双源向量 + 动态 α 系数）';
COMMENT ON COLUMN classification_folder_profiles_v5.content_embedding IS '内容向量（基于文件夹内书签内容生成）';
COMMENT ON COLUMN classification_folder_profiles_v5.behavior_embedding IS '行为向量（基于用户分类行为生成）';
COMMENT ON COLUMN classification_folder_profiles_v5.alpha_coefficient IS '动态 α 系数（0.2-0.8），控制内容向量和行为向量的权重';
COMMENT ON COLUMN classification_folder_profiles_v5.needs_update IS '是否需要更新画像（懒更新机制）';

-- ============================================
-- 表 2: T1 纠正队列（异步 LLM 纠正）
-- ============================================
CREATE TABLE IF NOT EXISTS classification_t1_queue_v5 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id BIGINT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,

  -- T0 结果
  t0_folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL,
  t0_confidence DECIMAL(3,2) NOT NULL,
  t0_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 触发 T1 的原因
  trigger_reason TEXT NOT NULL, -- 'low_confidence' | 'vector_conflict' | 'manual_request'

  -- T1 处理状态
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'completed' | 'failed'

  -- T1 结果
  t1_folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL,
  t1_confidence DECIMAL(3,2),
  t1_reasoning TEXT,
  t1_timestamp TIMESTAMPTZ,

  -- 错误信息
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 添加表注释
COMMENT ON TABLE classification_t1_queue_v5 IS '智能分类 v5.0 - T1 纠正队列（异步 LLM 纠正）';
COMMENT ON COLUMN classification_t1_queue_v5.trigger_reason IS '触发 T1 的原因：low_confidence（低置信度）、vector_conflict（向量冲突）、manual_request（手动请求）';
COMMENT ON COLUMN classification_t1_queue_v5.status IS 'T1 处理状态：pending（待处理）、processing（处理中）、completed（已完成）、failed（失败）';

-- ============================================
-- 表 3: 分类指标记录（监控与分析）
-- ============================================
CREATE TABLE IF NOT EXISTS classification_metrics_v5 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 分类元数据
  bookmark_id BIGINT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL,

  -- 性能指标
  stage TEXT NOT NULL, -- 'T0' | 'T1'
  latency_ms INTEGER NOT NULL,
  confidence DECIMAL(3,2) NOT NULL,

  -- 成本指标
  embedding_tokens INTEGER,
  llm_tokens INTEGER,

  -- 准确性指标（需要人工反馈）
  is_correct BOOLEAN,
  user_corrected_to_folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL,

  -- 降级信息
  degradation_level INTEGER DEFAULT 0, -- 0=v5.0, 1=v4.1, 2=规则匹配

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 添加表注释
COMMENT ON TABLE classification_metrics_v5 IS '智能分类 v5.0 - 分类指标记录（监控与分析）';
COMMENT ON COLUMN classification_metrics_v5.stage IS '分类阶段：T0（快速生成）、T1（LLM 纠正）';
COMMENT ON COLUMN classification_metrics_v5.degradation_level IS '降级级别：0=v5.0（正常）、1=v4.1（降级）、2=规则匹配（兜底）';

-- ============================================
-- 索引
-- ============================================

-- IVFFlat 向量索引（决策 2: lists=10，适用 <100 文件夹）
CREATE INDEX IF NOT EXISTS classification_folder_profiles_v5_content_embedding_idx
  ON classification_folder_profiles_v5
  USING ivfflat (content_embedding vector_cosine_ops)
  WITH (lists = 10);

CREATE INDEX IF NOT EXISTS classification_folder_profiles_v5_behavior_embedding_idx
  ON classification_folder_profiles_v5
  USING ivfflat (behavior_embedding vector_cosine_ops)
  WITH (lists = 10);

-- 常规索引
CREATE INDEX IF NOT EXISTS classification_folder_profiles_v5_user_id_idx
  ON classification_folder_profiles_v5(user_id);

CREATE INDEX IF NOT EXISTS classification_folder_profiles_v5_needs_update_idx
  ON classification_folder_profiles_v5(user_id, needs_update)
  WHERE needs_update = TRUE;

CREATE INDEX IF NOT EXISTS classification_t1_queue_v5_user_status_idx
  ON classification_t1_queue_v5(user_id, status);

CREATE INDEX IF NOT EXISTS classification_t1_queue_v5_pending_idx
  ON classification_t1_queue_v5(created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS classification_metrics_v5_user_id_idx
  ON classification_metrics_v5(user_id, created_at DESC);

-- ============================================
-- RLS 策略（多租户隔离）
-- ============================================

ALTER TABLE classification_folder_profiles_v5 ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_t1_queue_v5 ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_metrics_v5 ENABLE ROW LEVEL SECURITY;

-- Folder Profiles RLS
CREATE POLICY "用户只能访问自己的文件夹画像"
  ON classification_folder_profiles_v5
  FOR ALL
  USING (auth.uid() = user_id);

-- T1 Queue RLS
CREATE POLICY "用户只能访问自己的 T1 队列"
  ON classification_t1_queue_v5
  FOR ALL
  USING (auth.uid() = user_id);

-- Metrics RLS
CREATE POLICY "用户只能访问自己的分类指标"
  ON classification_metrics_v5
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- 触发器（自动更新 updated_at）
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_classification_folder_profiles_v5_updated_at
  BEFORE UPDATE ON classification_folder_profiles_v5
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classification_t1_queue_v5_updated_at
  BEFORE UPDATE ON classification_t1_queue_v5
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RPC 函数（向量检索）
-- ============================================

-- 匹配相似文件夹画像（基于内容向量）
CREATE OR REPLACE FUNCTION match_folder_profiles_v5(
  query_user_id UUID,
  query_embedding vector(1024),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  folder_id BIGINT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cfp.folder_id,
    1 - (cfp.content_embedding <=> query_embedding) AS similarity
  FROM classification_folder_profiles_v5 cfp
  WHERE cfp.user_id = query_user_id
    AND 1 - (cfp.content_embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- =============================================================================
-- V4.2 Folder Exclusions Table (Negative Sample Learning)
-- 文件夹排除规则表 - 负样本学习机制
--
-- 用途：记录用户明确表示不属于某文件夹的内容特征
-- - 用户手动移出的内容特征
-- - 半托管模式下拒绝的建议
-- - 批量操作识别出的排除模式
--
-- @version 1.0.0
-- @since 2025-12-11
-- =============================================================================

-- 1. 创建文件夹排除规则表
CREATE TABLE IF NOT EXISTS folder_exclusions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  folder_id BIGINT REFERENCES folders(id) ON DELETE CASCADE NOT NULL,

  -- 排除类型
  -- 'tag': 标签排除 - 带有某标签的内容不应放入此文件夹
  -- 'source': 来源排除 - 来自某来源的内容不应放入此文件夹
  -- 'embedding': 向量排除 - 与某向量相似的内容不应放入此文件夹
  -- 'keyword': 关键词排除 - 包含某关键词的内容不应放入此文件夹
  exclusion_type VARCHAR(50) NOT NULL,

  -- 排除值 (根据类型填充)
  excluded_tag VARCHAR(100),
  excluded_source_id VARCHAR(255),
  excluded_keyword VARCHAR(100),
  excluded_embedding VECTOR(1024),

  -- 权重 (0-1)，用于计算负样本匹配时的惩罚力度
  -- 权重越高，惩罚越大
  weight FLOAT DEFAULT 0.5 CHECK (weight >= 0 AND weight <= 1),

  -- 创建来源
  -- 'user_move': 用户手动移动触发
  -- 'user_reject': 用户拒绝建议触发
  -- 'bulk_move': 批量移动触发
  -- 'auto_learn': 系统自动学习
  created_from VARCHAR(50) NOT NULL,

  -- 原始书签 ID (用于追溯)
  original_bookmark_id BIGINT REFERENCES bookmarks(id) ON DELETE SET NULL,

  -- 有效期 (用于负样本衰减，NULL 表示永久有效)
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- 约束：排除类型与排除值的一致性
  CONSTRAINT exclusion_value_required CHECK (
    (exclusion_type = 'tag' AND excluded_tag IS NOT NULL) OR
    (exclusion_type = 'source' AND excluded_source_id IS NOT NULL) OR
    (exclusion_type = 'keyword' AND excluded_keyword IS NOT NULL) OR
    (exclusion_type = 'embedding' AND excluded_embedding IS NOT NULL)
  )
);

-- 2. 创建索引
-- 按文件夹查询索引
CREATE INDEX idx_folder_exclusions_folder ON folder_exclusions(folder_id);

-- 按用户查询索引
CREATE INDEX idx_folder_exclusions_user ON folder_exclusions(user_id);

-- 按用户和文件夹联合查询索引
CREATE INDEX idx_folder_exclusions_user_folder ON folder_exclusions(user_id, folder_id);

-- 标签排除索引 (条件索引)
CREATE INDEX idx_folder_exclusions_tag ON folder_exclusions(excluded_tag)
  WHERE exclusion_type = 'tag';

-- 来源排除索引 (条件索引)
CREATE INDEX idx_folder_exclusions_source ON folder_exclusions(excluded_source_id)
  WHERE exclusion_type = 'source';

-- 关键词排除索引 (条件索引)
CREATE INDEX idx_folder_exclusions_keyword ON folder_exclusions(excluded_keyword)
  WHERE exclusion_type = 'keyword';

-- 过期时间索引 (用于清理过期记录)
CREATE INDEX idx_folder_exclusions_expires ON folder_exclusions(expires_at)
  WHERE expires_at IS NOT NULL;

-- 3. 向量排除的相似度搜索索引 (HNSW)
-- 仅在有 embedding 时创建
CREATE INDEX idx_folder_exclusions_embedding ON folder_exclusions
  USING hnsw (excluded_embedding vector_cosine_ops)
  WHERE exclusion_type = 'embedding';

-- 4. 启用 RLS
ALTER TABLE folder_exclusions ENABLE ROW LEVEL SECURITY;

-- 5. RLS 策略 - 用户只能访问自己的排除规则
CREATE POLICY "Users can view their own exclusions"
  ON folder_exclusions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own exclusions"
  ON folder_exclusions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exclusions"
  ON folder_exclusions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exclusions"
  ON folder_exclusions FOR DELETE
  USING (auth.uid() = user_id);

-- 6. 创建唯一约束防止重复记录
-- 同一用户、同一文件夹、同一类型、同一值只能有一条记录
CREATE UNIQUE INDEX idx_folder_exclusions_unique_tag
  ON folder_exclusions(user_id, folder_id, excluded_tag)
  WHERE exclusion_type = 'tag';

CREATE UNIQUE INDEX idx_folder_exclusions_unique_source
  ON folder_exclusions(user_id, folder_id, excluded_source_id)
  WHERE exclusion_type = 'source';

CREATE UNIQUE INDEX idx_folder_exclusions_unique_keyword
  ON folder_exclusions(user_id, folder_id, excluded_keyword)
  WHERE exclusion_type = 'keyword';

-- 7. 创建清理过期记录的函数
CREATE OR REPLACE FUNCTION cleanup_expired_folder_exclusions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM folder_exclusions
  WHERE expires_at IS NOT NULL AND expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 8. 授予函数执行权限
GRANT EXECUTE ON FUNCTION cleanup_expired_folder_exclusions() TO authenticated;

-- 9. 添加注释
COMMENT ON TABLE folder_exclusions IS 'V4.2 文件夹排除规则表，用于负样本学习机制';
COMMENT ON COLUMN folder_exclusions.exclusion_type IS '排除类型: tag/source/embedding/keyword';
COMMENT ON COLUMN folder_exclusions.weight IS '排除权重 (0-1)，影响负样本匹配时的惩罚力度';
COMMENT ON COLUMN folder_exclusions.created_from IS '创建来源: user_move/user_reject/bulk_move/auto_learn';
COMMENT ON COLUMN folder_exclusions.expires_at IS '过期时间，用于负样本衰减机制';

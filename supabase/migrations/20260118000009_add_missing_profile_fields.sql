-- ============================================
-- Classification v5.0 - 补全文件夹画像表字段
-- 创建日期: 2026-01-18
-- 说明: 添加规范文档中定义但当前实现缺失的字段
-- ============================================

-- 添加缺失字段到 classification_folder_profiles_v5 表
ALTER TABLE classification_folder_profiles_v5
  -- 内聚性分数 [0-1]
  ADD COLUMN IF NOT EXISTS internal_similarity DECIMAL(3,2),

  -- 高频标签 Top 10
  ADD COLUMN IF NOT EXISTS top_tags TEXT[],

  -- 样本标题 Top 5
  ADD COLUMN IF NOT EXISTS sample_titles TEXT[],

  -- 杂物堆文件夹标记
  ADD COLUMN IF NOT EXISTS is_generic BOOLEAN DEFAULT FALSE,

  -- 排除自动分类标记
  ADD COLUMN IF NOT EXISTS is_excluded BOOLEAN DEFAULT FALSE,

  -- 变动计数器(用于懒更新触发)
  ADD COLUMN IF NOT EXISTS change_count INTEGER DEFAULT 0,

  -- 上次计算时间(与last_updated_at语义不同)
  ADD COLUMN IF NOT EXISTS last_computed_at TIMESTAMPTZ,

  -- 活跃度权重(用于Rerank)
  ADD COLUMN IF NOT EXISTS activity_score DECIMAL(3,2) DEFAULT 0,

  -- 最后使用时间
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- 添加字段注释
COMMENT ON COLUMN classification_folder_profiles_v5.internal_similarity IS '文件夹内聚性分数 [0-1]，衡量文件夹内容的相似度';
COMMENT ON COLUMN classification_folder_profiles_v5.top_tags IS '高频标签 Top 10，用于快速匹配';
COMMENT ON COLUMN classification_folder_profiles_v5.sample_titles IS '样本标题 Top 5，用于展示文件夹特征';
COMMENT ON COLUMN classification_folder_profiles_v5.is_generic IS '杂物堆文件夹标记，内容过于杂乱的文件夹';
COMMENT ON COLUMN classification_folder_profiles_v5.is_excluded IS '排除自动分类标记，用户手动标记不参与自动分类';
COMMENT ON COLUMN classification_folder_profiles_v5.change_count IS '变动计数器，累计变动次数，用于触发懒更新';
COMMENT ON COLUMN classification_folder_profiles_v5.last_computed_at IS '上次向量计算时间，与last_updated_at区分';
COMMENT ON COLUMN classification_folder_profiles_v5.activity_score IS '活跃度权重 [0-1]，用于Rerank排序';
COMMENT ON COLUMN classification_folder_profiles_v5.last_used_at IS '最后使用时间，记录最近一次分类到该文件夹的时间';

-- 添加索引
-- 变动计数索引(用于查找需要更新的画像)
CREATE INDEX IF NOT EXISTS idx_classification_folder_profiles_v5_dirty
  ON classification_folder_profiles_v5(user_id, change_count)
  WHERE change_count > 0;

-- 活跃度索引(用于Rerank排序)
CREATE INDEX IF NOT EXISTS idx_classification_folder_profiles_v5_activity
  ON classification_folder_profiles_v5(user_id, activity_score DESC)
  WHERE activity_score > 0;

-- 排除标记索引(用于过滤排除的文件夹)
CREATE INDEX IF NOT EXISTS idx_classification_folder_profiles_v5_excluded
  ON classification_folder_profiles_v5(user_id, is_excluded)
  WHERE is_excluded = FALSE;

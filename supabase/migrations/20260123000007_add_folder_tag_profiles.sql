-- =============================================================================
-- 迁移: 新增文件夹标签画像表
-- 用于 AI 标签优先匹配系统
-- 版本: v5.1
-- 日期: 2026-01-23
-- =============================================================================

-- 创建文件夹标签画像表
CREATE TABLE IF NOT EXISTS folder_tag_profiles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,

  -- 核心标签（高频 + 高权重，出现频率 >= 30%）
  core_tags TEXT[] DEFAULT '{}',

  -- 相关标签（中低频，出现频率 10%-30%）
  related_tags TEXT[] DEFAULT '{}',

  -- 标签频率统计 JSONB: { "标签名": 出现次数 }
  tag_frequency JSONB DEFAULT '{}',

  -- 文件夹名分词（用于匹配）
  folder_name_tokens TEXT[] DEFAULT '{}',

  -- 统计信息
  bookmark_count INTEGER DEFAULT 0,
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 唯一约束
  UNIQUE(user_id, folder_id)
);

-- 添加表注释
COMMENT ON TABLE folder_tag_profiles IS '文件夹标签画像表，用于 AI 标签优先匹配';
COMMENT ON COLUMN folder_tag_profiles.core_tags IS '核心标签（出现频率 >= 30%）';
COMMENT ON COLUMN folder_tag_profiles.related_tags IS '相关标签（出现频率 10%-30%）';
COMMENT ON COLUMN folder_tag_profiles.tag_frequency IS '标签频率统计 JSON';
COMMENT ON COLUMN folder_tag_profiles.folder_name_tokens IS '文件夹名分词';
COMMENT ON COLUMN folder_tag_profiles.bookmark_count IS '文件夹内书签数量';

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_folder_tag_profiles_user
  ON folder_tag_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_folder_tag_profiles_folder
  ON folder_tag_profiles(folder_id);

CREATE INDEX IF NOT EXISTS idx_folder_tag_profiles_core_tags
  ON folder_tag_profiles USING GIN(core_tags);

CREATE INDEX IF NOT EXISTS idx_folder_tag_profiles_related_tags
  ON folder_tag_profiles USING GIN(related_tags);

-- RLS 策略
ALTER TABLE folder_tag_profiles ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的文件夹画像
CREATE POLICY "Users can view own folder tag profiles"
  ON folder_tag_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own folder tag profiles"
  ON folder_tag_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folder tag profiles"
  ON folder_tag_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own folder tag profiles"
  ON folder_tag_profiles
  FOR DELETE
  USING (auth.uid() = user_id);

-- 服务角色完全访问
CREATE POLICY "Service role has full access to folder tag profiles"
  ON folder_tag_profiles
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

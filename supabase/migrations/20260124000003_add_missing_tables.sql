-- ============================================
-- 添加缺失的数据库表
-- 修复类型检查错误：user_corrections, tags, bookmark_tags
-- ============================================

-- 1. 用户纠正记录表
-- 用于记录用户对 AI 分类结果的纠正，帮助系统学习
CREATE TABLE IF NOT EXISTS user_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id BIGINT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  original_folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL,
  corrected_folder_id BIGINT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  correction_type TEXT NOT NULL DEFAULT 'manual' CHECK (correction_type IN ('move', 'reassign', 'manual')),
  confidence_before NUMERIC(5,4),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_user_corrections_user_id ON user_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_corrections_bookmark_id ON user_corrections(bookmark_id);
CREATE INDEX IF NOT EXISTS idx_user_corrections_created_at ON user_corrections(created_at DESC);

-- RLS
ALTER TABLE user_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户只能查看自己的纠正记录"
  ON user_corrections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "用户只能插入自己的纠正记录"
  ON user_corrections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户只能删除自己的纠正记录"
  ON user_corrections FOR DELETE
  USING (auth.uid() = user_id);

-- 2. 标签表
-- 用于存储用户创建的标签
CREATE TABLE IF NOT EXISTS tags (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- RLS
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户只能查看自己的标签"
  ON tags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "用户只能创建自己的标签"
  ON tags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户只能更新自己的标签"
  ON tags FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "用户只能删除自己的标签"
  ON tags FOR DELETE
  USING (auth.uid() = user_id);

-- 3. 书签标签关联表
-- 用于存储书签和标签的多对多关系
CREATE TABLE IF NOT EXISTS bookmark_tags (
  id BIGSERIAL PRIMARY KEY,
  bookmark_id BIGINT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bookmark_id, tag_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_bookmark_tags_bookmark_id ON bookmark_tags(bookmark_id);
CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag_id ON bookmark_tags(tag_id);

-- RLS (通过 bookmark 的 user_id 间接控制)
ALTER TABLE bookmark_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户只能查看自己书签的标签关联"
  ON bookmark_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookmarks b
      WHERE b.id = bookmark_tags.bookmark_id
      AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "用户只能为自己的书签添加标签"
  ON bookmark_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookmarks b
      WHERE b.id = bookmark_tags.bookmark_id
      AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "用户只能删除自己书签的标签关联"
  ON bookmark_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM bookmarks b
      WHERE b.id = bookmark_tags.bookmark_id
      AND b.user_id = auth.uid()
    )
  );

-- 4. 更新 tags 表的 updated_at 触发器
CREATE OR REPLACE FUNCTION update_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tags_updated_at ON tags;
CREATE TRIGGER trigger_update_tags_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW
  EXECUTE FUNCTION update_tags_updated_at();

-- 完成
COMMENT ON TABLE user_corrections IS '用户对 AI 分类结果的纠正记录，用于系统学习';
COMMENT ON TABLE tags IS '用户创建的标签';
COMMENT ON TABLE bookmark_tags IS '书签和标签的多对多关联表';

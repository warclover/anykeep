-- ============================================
-- MD 收藏高亮标记表
-- Spec: md-reader-upgrade / REQ-10
-- 版本: 1.0.0
-- 日期: 2025-12-28
-- ============================================

-- 1. 创建高亮标记表
CREATE TABLE IF NOT EXISTS md_collection_highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id BIGINT NOT NULL REFERENCES md_collections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 定位信息
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  anchor_text TEXT NOT NULL,           -- 用于内容变更后模糊匹配

  -- 样式
  color VARCHAR(20) NOT NULL CHECK (color IN ('yellow', 'green', 'blue', 'pink', 'purple')),

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 约束
  CONSTRAINT valid_offset CHECK (start_offset >= 0 AND end_offset > start_offset),
  CONSTRAINT anchor_text_not_empty CHECK (length(anchor_text) > 0)
);

-- 2. 创建索引
-- 按文档查询高亮
CREATE INDEX IF NOT EXISTS idx_highlights_collection
  ON md_collection_highlights(collection_id);

-- 按用户查询高亮
CREATE INDEX IF NOT EXISTS idx_highlights_user
  ON md_collection_highlights(user_id);

-- 复合索引：用户的文档高亮
CREATE INDEX IF NOT EXISTS idx_highlights_user_collection
  ON md_collection_highlights(user_id, collection_id);

-- 3. 启用 RLS
ALTER TABLE md_collection_highlights ENABLE ROW LEVEL SECURITY;

-- 4. RLS 策略
-- 用户只能查看自己的高亮
CREATE POLICY "Users can view own highlights"
  ON md_collection_highlights FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能创建自己的高亮
CREATE POLICY "Users can create own highlights"
  ON md_collection_highlights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的高亮
CREATE POLICY "Users can update own highlights"
  ON md_collection_highlights FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 用户只能删除自己的高亮
CREATE POLICY "Users can delete own highlights"
  ON md_collection_highlights FOR DELETE
  USING (auth.uid() = user_id);

-- 5. 自动更新 updated_at 触发器
CREATE OR REPLACE FUNCTION update_highlights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_highlights_updated_at
  BEFORE UPDATE ON md_collection_highlights
  FOR EACH ROW
  EXECUTE FUNCTION update_highlights_updated_at();

-- 6. 添加表注释
COMMENT ON TABLE md_collection_highlights IS 'MD 收藏文字高亮标记';
COMMENT ON COLUMN md_collection_highlights.start_offset IS '高亮起始字符偏移';
COMMENT ON COLUMN md_collection_highlights.end_offset IS '高亮结束字符偏移';
COMMENT ON COLUMN md_collection_highlights.anchor_text IS '锚定文本，用于内容变更后重新定位';
COMMENT ON COLUMN md_collection_highlights.color IS '高亮颜色: yellow/green/blue/pink/purple';

-- ============================================
-- 迁移完成
-- 执行: supabase db push 或 supabase migration up
-- ============================================

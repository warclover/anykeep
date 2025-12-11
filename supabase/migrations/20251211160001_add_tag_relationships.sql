-- Migration: Add Tag Relationships Table
-- Description: 标签图谱 - 存储标签之间的关系（同义词、相关、父子）
-- Version: V4.2
-- Date: 2025-12-11

-- ============================================================================
-- 标签关系表
-- ============================================================================

CREATE TABLE IF NOT EXISTS tag_relationships (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 关系类型: synonym (同义词), related (相关), parent (父标签)
  relationship_type VARCHAR(20) NOT NULL CHECK (relationship_type IN ('synonym', 'related', 'parent')),

  -- 标签对
  source_tag TEXT NOT NULL,
  target_tag TEXT NOT NULL,

  -- 权重 (0.00-1.00)，表示关系强度
  weight DECIMAL(3,2) NOT NULL DEFAULT 0.50 CHECK (weight >= 0 AND weight <= 1),

  -- 来源: system (系统预设), learned (行为学习), user (用户定义)
  source VARCHAR(20) NOT NULL DEFAULT 'learned' CHECK (source IN ('system', 'learned', 'user')),

  -- 共现次数（用于学习权重调整）
  co_occurrence_count INT NOT NULL DEFAULT 0,

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 唯一约束：同一用户下，同一标签对和关系类型只能有一条记录
  UNIQUE(user_id, source_tag, target_tag, relationship_type)
);

-- ============================================================================
-- 索引
-- ============================================================================

-- 按用户和源标签查询（查找某标签的所有相关标签）
CREATE INDEX IF NOT EXISTS idx_tag_rel_user_source
  ON tag_relationships(user_id, source_tag);

-- 按用户和目标标签查询（反向查找）
CREATE INDEX IF NOT EXISTS idx_tag_rel_user_target
  ON tag_relationships(user_id, target_tag);

-- 按关系类型筛选
CREATE INDEX IF NOT EXISTS idx_tag_rel_type
  ON tag_relationships(user_id, relationship_type);

-- 按权重排序（获取最相关的标签）
CREATE INDEX IF NOT EXISTS idx_tag_rel_weight
  ON tag_relationships(user_id, source_tag, weight DESC);

-- ============================================================================
-- 触发器：自动更新 updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_tag_relationships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tag_relationships_updated_at ON tag_relationships;
CREATE TRIGGER trigger_tag_relationships_updated_at
  BEFORE UPDATE ON tag_relationships
  FOR EACH ROW
  EXECUTE FUNCTION update_tag_relationships_updated_at();

-- ============================================================================
-- RLS 策略
-- ============================================================================

ALTER TABLE tag_relationships ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的标签关系
DROP POLICY IF EXISTS "Users can view own tag relationships" ON tag_relationships;
CREATE POLICY "Users can view own tag relationships"
  ON tag_relationships
  FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能创建自己的标签关系
DROP POLICY IF EXISTS "Users can create own tag relationships" ON tag_relationships;
CREATE POLICY "Users can create own tag relationships"
  ON tag_relationships
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的标签关系
DROP POLICY IF EXISTS "Users can update own tag relationships" ON tag_relationships;
CREATE POLICY "Users can update own tag relationships"
  ON tag_relationships
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 用户只能删除自己的标签关系
DROP POLICY IF EXISTS "Users can delete own tag relationships" ON tag_relationships;
CREATE POLICY "Users can delete own tag relationships"
  ON tag_relationships
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 辅助函数：增加共现计数
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_tag_cooccurrence(
  p_user_id UUID,
  p_source_tag TEXT,
  p_target_tag TEXT,
  p_relationship_type VARCHAR(20) DEFAULT 'related'
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO tag_relationships (
    user_id, source_tag, target_tag, relationship_type, co_occurrence_count, weight
  )
  VALUES (
    p_user_id, p_source_tag, p_target_tag, p_relationship_type, 1, 0.30
  )
  ON CONFLICT (user_id, source_tag, target_tag, relationship_type)
  DO UPDATE SET
    co_occurrence_count = tag_relationships.co_occurrence_count + 1,
    -- 权重随共现次数增加而增加，最大不超过 0.95
    weight = LEAST(0.95, 0.30 + (tag_relationships.co_occurrence_count + 1) * 0.05),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 辅助函数：获取标签的同义词
-- ============================================================================

CREATE OR REPLACE FUNCTION get_tag_synonyms(
  p_user_id UUID,
  p_tag TEXT
)
RETURNS TABLE (
  synonym TEXT,
  weight DECIMAL(3,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN tr.source_tag = p_tag THEN tr.target_tag
      ELSE tr.source_tag
    END AS synonym,
    tr.weight
  FROM tag_relationships tr
  WHERE tr.user_id = p_user_id
    AND tr.relationship_type = 'synonym'
    AND (tr.source_tag = p_tag OR tr.target_tag = p_tag)
  ORDER BY tr.weight DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 辅助函数：获取相关标签
-- ============================================================================

CREATE OR REPLACE FUNCTION get_related_tags(
  p_user_id UUID,
  p_tag TEXT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  related_tag TEXT,
  relationship_type VARCHAR(20),
  weight DECIMAL(3,2),
  co_occurrence_count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN tr.source_tag = p_tag THEN tr.target_tag
      ELSE tr.source_tag
    END AS related_tag,
    tr.relationship_type,
    tr.weight,
    tr.co_occurrence_count
  FROM tag_relationships tr
  WHERE tr.user_id = p_user_id
    AND (tr.source_tag = p_tag OR tr.target_tag = p_tag)
  ORDER BY tr.weight DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 注释
-- ============================================================================

COMMENT ON TABLE tag_relationships IS '标签图谱 - 存储标签之间的关系';
COMMENT ON COLUMN tag_relationships.relationship_type IS '关系类型: synonym=同义词, related=相关, parent=父标签';
COMMENT ON COLUMN tag_relationships.source IS '来源: system=系统预设, learned=行为学习, user=用户定义';
COMMENT ON COLUMN tag_relationships.weight IS '关系权重 0-1，数值越大关系越强';
COMMENT ON COLUMN tag_relationships.co_occurrence_count IS '共现次数，用于自动学习';

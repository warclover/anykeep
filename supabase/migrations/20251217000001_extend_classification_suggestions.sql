-- =====================================================
-- V4.2 Classification Suggestions 表扩展
-- 支持批量聚类建议和多种动作类型
-- =====================================================

-- 1. 添加新列
ALTER TABLE public.classification_suggestions
ADD COLUMN IF NOT EXISTS bookmark_ids BIGINT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS suggested_action VARCHAR(50) DEFAULT 'move_to_folder',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 2. 迁移现有数据：将 bookmark_id (单数) 迁移到 bookmark_ids (数组)
UPDATE public.classification_suggestions
SET bookmark_ids = ARRAY[bookmark_id]
WHERE (bookmark_ids = '{}' OR bookmark_ids IS NULL)
  AND bookmark_id IS NOT NULL;

-- 3. 添加约束：限制 suggested_action 的可选值
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_suggested_action'
  ) THEN
    ALTER TABLE public.classification_suggestions
    ADD CONSTRAINT chk_suggested_action
    CHECK (suggested_action IN ('move_to_folder', 'create_folder', 'merge_folders', 'add_tags'));
  END IF;
END $$;

-- 4. 添加索引：优化按动作类型查询
CREATE INDEX IF NOT EXISTS idx_classification_suggestions_action
ON public.classification_suggestions(suggested_action);

-- 5. 添加 GIN 索引：优化 bookmark_ids 数组查询
CREATE INDEX IF NOT EXISTS idx_classification_suggestions_bookmark_ids
ON public.classification_suggestions USING GIN (bookmark_ids);

-- 6. 添加 GIN 索引：优化 metadata JSONB 查询
CREATE INDEX IF NOT EXISTS idx_classification_suggestions_metadata
ON public.classification_suggestions USING GIN (metadata);

-- 7. 添加注释
COMMENT ON COLUMN public.classification_suggestions.bookmark_ids IS '关联的书签ID数组，支持批量建议（向后兼容：如果为空，使用 bookmark_id）';
COMMENT ON COLUMN public.classification_suggestions.suggested_action IS '建议动作类型：move_to_folder=移动到文件夹, create_folder=创建新文件夹, merge_folders=合并文件夹, add_tags=添加标签';
COMMENT ON COLUMN public.classification_suggestions.metadata IS '扩展元数据，如置信度详情、相关标签、聚类信息等';

-- 8. 创建辅助函数：获取建议关联的所有书签ID（兼容新旧数据）
CREATE OR REPLACE FUNCTION get_suggestion_bookmark_ids(p_suggestion_id BIGINT)
RETURNS BIGINT[]
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_bookmark_ids BIGINT[];
  v_bookmark_id BIGINT;
BEGIN
  SELECT bookmark_ids, bookmark_id
  INTO v_bookmark_ids, v_bookmark_id
  FROM public.classification_suggestions
  WHERE id = p_suggestion_id;

  -- 如果 bookmark_ids 有值，直接返回
  IF v_bookmark_ids IS NOT NULL AND array_length(v_bookmark_ids, 1) > 0 THEN
    RETURN v_bookmark_ids;
  END IF;

  -- 否则返回 bookmark_id 作为数组
  IF v_bookmark_id IS NOT NULL THEN
    RETURN ARRAY[v_bookmark_id];
  END IF;

  RETURN '{}';
END;
$$;

COMMENT ON FUNCTION get_suggestion_bookmark_ids IS '获取建议关联的所有书签ID，兼容新旧数据格式';

-- ============================================
-- 批量标签操作函数
-- 用于批量添加/移除书签标签
-- ============================================

-- ============================================
-- 批量添加标签函数
-- ============================================
CREATE OR REPLACE FUNCTION batch_add_tags(
  p_user_id UUID,
  p_bookmark_ids INT[],
  p_tags TEXT[]
)
RETURNS JSON AS $$
DECLARE
  v_affected_ids INT[];
  v_affected_count INT;
BEGIN
  -- 更新书签，添加新标签（去重）
  WITH updated AS (
    UPDATE bookmarks
    SET
      user_tags = (
        SELECT ARRAY(
          SELECT DISTINCT unnest(
            array_cat(COALESCE(user_tags, ARRAY[]::TEXT[]), p_tags)
          )
        )
      ),
      updated_at = NOW()
    WHERE id = ANY(p_bookmark_ids)
      AND user_id = p_user_id
      AND deleted_at IS NULL
    RETURNING id
  )
  SELECT ARRAY_AGG(id), COUNT(*)
  INTO v_affected_ids, v_affected_count
  FROM updated;

  RETURN json_build_object(
    'affected_ids', COALESCE(v_affected_ids, ARRAY[]::INT[]),
    'affected_count', COALESCE(v_affected_count, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 批量移除标签函数
-- ============================================
CREATE OR REPLACE FUNCTION batch_remove_tags(
  p_user_id UUID,
  p_bookmark_ids INT[],
  p_tags TEXT[]
)
RETURNS JSON AS $$
DECLARE
  v_affected_ids INT[];
  v_affected_count INT;
BEGIN
  -- 更新书签，移除指定标签
  WITH updated AS (
    UPDATE bookmarks
    SET
      user_tags = (
        SELECT ARRAY(
          SELECT unnest(user_tags)
          EXCEPT
          SELECT unnest(p_tags)
        )
      ),
      updated_at = NOW()
    WHERE id = ANY(p_bookmark_ids)
      AND user_id = p_user_id
      AND deleted_at IS NULL
      AND user_tags && p_tags  -- 只更新包含这些标签的书签
    RETURNING id
  )
  SELECT ARRAY_AGG(id), COUNT(*)
  INTO v_affected_ids, v_affected_count
  FROM updated;

  RETURN json_build_object(
    'affected_ids', COALESCE(v_affected_ids, ARRAY[]::INT[]),
    'affected_count', COALESCE(v_affected_count, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 授权
-- ============================================
GRANT EXECUTE ON FUNCTION batch_add_tags TO authenticated;
GRANT EXECUTE ON FUNCTION batch_remove_tags TO authenticated;

-- ============================================
-- 注释
-- ============================================
COMMENT ON FUNCTION batch_add_tags IS '批量为书签添加标签，自动去重，返回受影响的书签ID列表和数量';
COMMENT ON FUNCTION batch_remove_tags IS '批量从书签移除指定标签，仅更新包含这些标签的书签';

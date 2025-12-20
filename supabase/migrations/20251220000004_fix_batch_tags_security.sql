-- ============================================
-- 安全修复：批量标签操作函数
-- 使用 auth.uid() 替代传入的 p_user_id 参数
-- 防止未授权访问其他用户的书签
-- ============================================

-- ============================================
-- 删除旧函数
-- ============================================
DROP FUNCTION IF EXISTS batch_add_tags(UUID, INT[], TEXT[]);
DROP FUNCTION IF EXISTS batch_remove_tags(UUID, INT[], TEXT[]);

-- ============================================
-- 批量添加标签函数（安全版）
-- ============================================
CREATE OR REPLACE FUNCTION batch_add_tags(
  p_bookmark_ids INT[],
  p_tags TEXT[]
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_affected_ids INT[];
  v_affected_count INT;
BEGIN
  -- 获取当前认证用户 ID
  v_user_id := auth.uid();

  -- 验证用户已登录
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

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
      AND user_id = v_user_id  -- 使用认证的用户 ID
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
-- 批量移除标签函数（安全版）
-- ============================================
CREATE OR REPLACE FUNCTION batch_remove_tags(
  p_bookmark_ids INT[],
  p_tags TEXT[]
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_affected_ids INT[];
  v_affected_count INT;
BEGIN
  -- 获取当前认证用户 ID
  v_user_id := auth.uid();

  -- 验证用户已登录
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

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
      AND user_id = v_user_id  -- 使用认证的用户 ID
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
GRANT EXECUTE ON FUNCTION batch_add_tags(INT[], TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION batch_remove_tags(INT[], TEXT[]) TO authenticated;

-- ============================================
-- 注释
-- ============================================
COMMENT ON FUNCTION batch_add_tags(INT[], TEXT[]) IS '批量为书签添加标签（安全版），使用 auth.uid() 验证用户身份';
COMMENT ON FUNCTION batch_remove_tags(INT[], TEXT[]) IS '批量从书签移除标签（安全版），使用 auth.uid() 验证用户身份';

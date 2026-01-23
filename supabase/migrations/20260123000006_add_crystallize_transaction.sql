-- ===========================================
-- AnyKeep v5.5 - 结晶事务函数
-- ===========================================
-- 版本: 5.5.1
-- 日期: 2026-01-23
-- 说明: 原子化结晶操作，保证数据一致性

-- 结晶事务函数：创建文件夹 + 移动书签 + 标记混沌池
CREATE OR REPLACE FUNCTION crystallize_folder(
  p_user_id UUID,
  p_folder_name TEXT,
  p_bookmark_ids BIGINT[],
  p_ai_source TEXT DEFAULT 'CRYSTAL_GROWTH'
)
RETURNS TABLE (
  folder_id BIGINT,
  folder_name TEXT,
  bookmarks_moved INT
) AS $$
DECLARE
  v_folder_id BIGINT;
  v_bookmarks_moved INT;
BEGIN
  -- Step 1: 创建文件夹
  INSERT INTO public.folders (
    user_id,
    name,
    is_ai_generated,
    ai_generation_source,
    crystal_birth_time,
    origin_bookmark_ids,
    is_naming_pending
  ) VALUES (
    p_user_id,
    p_folder_name,
    TRUE,
    p_ai_source,
    NOW(),
    p_bookmark_ids,
    TRUE
  )
  RETURNING id INTO v_folder_id;

  -- Step 2: 移动书签到新文件夹
  UPDATE public.bookmarks
  SET folder_id = v_folder_id, updated_at = NOW()
  WHERE id = ANY(p_bookmark_ids)
    AND user_id = p_user_id;

  GET DIAGNOSTICS v_bookmarks_moved = ROW_COUNT;

  -- Step 3: 标记混沌池记录已处理
  UPDATE public.chaos_pool
  SET
    crystal_processed = TRUE,
    processed_at = NOW(),
    result_folder_id = v_folder_id
  WHERE user_id = p_user_id
    AND bookmark_id = ANY(p_bookmark_ids);

  -- 返回结果
  RETURN QUERY SELECT v_folder_id, p_folder_name, v_bookmarks_moved;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION crystallize_folder(UUID, TEXT, BIGINT[], TEXT) IS
  'V5.5 原子化结晶操作：创建文件夹、移动书签、标记混沌池在同一事务中完成';

-- 授权
GRANT EXECUTE ON FUNCTION crystallize_folder(UUID, TEXT, BIGINT[], TEXT) TO authenticated;

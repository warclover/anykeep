-- ============================================
-- Classification v5.0 - 批量确认影子分拣建议
-- 创建日期: 2026-01-18
-- 说明: 批量确认影子分拣建议,将书签移动到建议的文件夹
-- ============================================

CREATE OR REPLACE FUNCTION shadow_sorting_batch_confirm(
  p_bookmark_ids BIGINT[]
)
RETURNS TABLE (
  bookmark_id BIGINT,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_user_id UUID;
  v_bookmark_id BIGINT;
  v_shadow_folder_id BIGINT;
BEGIN
  -- 获取当前用户ID
  v_user_id := auth.uid();

  -- 遍历每个书签ID
  FOREACH v_bookmark_id IN ARRAY p_bookmark_ids
  LOOP
    BEGIN
      -- 获取书签的影子文件夹ID
      SELECT b.shadow_folder_id
      INTO v_shadow_folder_id
      FROM bookmarks b
      WHERE b.id = v_bookmark_id AND b.user_id = v_user_id;

      -- 检查书签是否存在且有影子建议
      IF v_shadow_folder_id IS NULL THEN
        RETURN QUERY SELECT v_bookmark_id, FALSE, 'No shadow suggestion found'::TEXT;
        CONTINUE;
      END IF;

      -- 更新书签的文件夹ID,清除影子建议
      UPDATE bookmarks
      SET
        folder_id = v_shadow_folder_id,
        shadow_folder_id = NULL,
        shadow_folder_name = NULL,
        shadow_confidence = NULL,
        shadow_suggested_at = NULL,
        updated_at = NOW()
      WHERE id = v_bookmark_id AND user_id = v_user_id;

      -- 返回成功结果
      RETURN QUERY SELECT v_bookmark_id, TRUE, NULL::TEXT;

    EXCEPTION WHEN OTHERS THEN
      -- 捕获错误并返回
      RETURN QUERY SELECT v_bookmark_id, FALSE, SQLERRM::TEXT;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION shadow_sorting_batch_confirm IS '批量确认影子分拣建议,将书签移动到建议的文件夹';

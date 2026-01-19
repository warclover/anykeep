-- ============================================
-- Classification v5.0 - 批量拒绝影子分拣建议
-- 创建日期: 2026-01-18
-- 说明: 批量拒绝影子分拣建议,清除影子字段
-- ============================================

CREATE OR REPLACE FUNCTION shadow_sorting_batch_reject(
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
BEGIN
  -- 获取当前用户ID
  v_user_id := auth.uid();

  -- 遍历每个书签ID
  FOREACH v_bookmark_id IN ARRAY p_bookmark_ids
  LOOP
    BEGIN
      -- 清除书签的影子建议
      UPDATE bookmarks
      SET
        shadow_folder_id = NULL,
        shadow_folder_name = NULL,
        shadow_confidence = NULL,
        shadow_suggested_at = NULL,
        updated_at = NOW()
      WHERE id = v_bookmark_id AND user_id = v_user_id;

      -- 检查是否更新成功
      IF NOT FOUND THEN
        RETURN QUERY SELECT v_bookmark_id, FALSE, 'Bookmark not found'::TEXT;
        CONTINUE;
      END IF;

      -- 返回成功结果
      RETURN QUERY SELECT v_bookmark_id, TRUE, NULL::TEXT;

    EXCEPTION WHEN OTHERS THEN
      -- 捕获错误并返回
      RETURN QUERY SELECT v_bookmark_id, FALSE, SQLERRM::TEXT;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION shadow_sorting_batch_reject IS '批量拒绝影子分拣建议,清除影子字段';

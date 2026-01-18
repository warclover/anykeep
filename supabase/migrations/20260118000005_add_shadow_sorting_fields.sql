-- ============================================
-- Classification v5.0 - Shadow Sorting 字段
-- 创建日期: 2026-01-18
-- 说明: 扩展 bookmarks 表，支持影子分拣功能（Inbox Zero 模式）
-- ============================================

-- ============================================
-- 扩展 bookmarks 表
-- ============================================

-- 添加影子分拣字段
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS shadow_folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS shadow_folder_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS shadow_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS shadow_suggested_at TIMESTAMPTZ;

-- 添加字段注释
COMMENT ON COLUMN bookmarks.shadow_folder_id IS '影子分拣建议的文件夹ID（建议路径但不移动）';
COMMENT ON COLUMN bookmarks.shadow_folder_name IS '影子分拣建议的文件夹名称（冗余字段，便于显示）';
COMMENT ON COLUMN bookmarks.shadow_confidence IS '影子分拣建议的置信度（0-1）';
COMMENT ON COLUMN bookmarks.shadow_suggested_at IS '影子分拣建议的时间戳';

-- ============================================
-- 索引
-- ============================================

-- 影子分拣待处理列表索引
CREATE INDEX IF NOT EXISTS idx_bookmarks_shadow_folder
ON bookmarks(user_id, shadow_folder_id, shadow_suggested_at DESC)
WHERE shadow_folder_id IS NOT NULL;

-- 影子分拣文件夹关联索引
CREATE INDEX IF NOT EXISTS idx_bookmarks_shadow_folder_id
ON bookmarks(shadow_folder_id)
WHERE shadow_folder_id IS NOT NULL;

-- ============================================
-- RPC 函数：批量确认影子分拣
-- ============================================

CREATE OR REPLACE FUNCTION shadow_sorting_batch_confirm(
  p_bookmark_ids BIGINT[]
)
RETURNS TABLE(
  bookmark_id BIGINT,
  success BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_bookmark_id BIGINT;
  v_shadow_folder_id BIGINT;
BEGIN
  -- 1. 获取当前用户ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- 2. 遍历书签ID列表
  FOREACH v_bookmark_id IN ARRAY p_bookmark_ids
  LOOP
    BEGIN
      -- 3. 获取影子文件夹ID
      SELECT shadow_folder_id INTO v_shadow_folder_id
      FROM bookmarks
      WHERE id = v_bookmark_id
        AND user_id = v_user_id
        AND shadow_folder_id IS NOT NULL;

      -- 4. 如果没有影子建议，跳过
      IF v_shadow_folder_id IS NULL THEN
        RETURN QUERY SELECT v_bookmark_id, FALSE, 'No shadow suggestion found'::TEXT;
        CONTINUE;
      END IF;

      -- 5. 移动书签到影子文件夹，清除影子字段
      UPDATE bookmarks
      SET
        folder_id = v_shadow_folder_id,
        shadow_folder_id = NULL,
        shadow_folder_name = NULL,
        shadow_confidence = NULL,
        shadow_suggested_at = NULL,
        updated_at = NOW()
      WHERE id = v_bookmark_id AND user_id = v_user_id;

      -- 6. 返回成功结果
      RETURN QUERY SELECT v_bookmark_id, TRUE, NULL::TEXT;

    EXCEPTION WHEN OTHERS THEN
      -- 返回失败结果
      RETURN QUERY SELECT v_bookmark_id, FALSE, SQLERRM;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION shadow_sorting_batch_confirm IS
'批量确认影子分拣建议，将书签移动到建议的文件夹并清除影子字段。';

-- ============================================
-- RPC 函数：批量拒绝影子分拣
-- ============================================

CREATE OR REPLACE FUNCTION shadow_sorting_batch_reject(
  p_bookmark_ids BIGINT[]
)
RETURNS TABLE(
  bookmark_id BIGINT,
  success BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_bookmark_id BIGINT;
BEGIN
  -- 1. 获取当前用户ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- 2. 遍历书签ID列表
  FOREACH v_bookmark_id IN ARRAY p_bookmark_ids
  LOOP
    BEGIN
      -- 3. 清除影子字段
      UPDATE bookmarks
      SET
        shadow_folder_id = NULL,
        shadow_folder_name = NULL,
        shadow_confidence = NULL,
        shadow_suggested_at = NULL,
        updated_at = NOW()
      WHERE id = v_bookmark_id
        AND user_id = v_user_id
        AND shadow_folder_id IS NOT NULL;

      -- 4. 返回成功结果
      RETURN QUERY SELECT v_bookmark_id, TRUE, NULL::TEXT;

    EXCEPTION WHEN OTHERS THEN
      -- 返回失败结果
      RETURN QUERY SELECT v_bookmark_id, FALSE, SQLERRM;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION shadow_sorting_batch_reject IS
'批量拒绝影子分拣建议，清除影子字段但不移动书签。';

-- ============================================
-- 授权
-- ============================================

GRANT EXECUTE ON FUNCTION shadow_sorting_batch_confirm TO authenticated;
GRANT EXECUTE ON FUNCTION shadow_sorting_batch_reject TO authenticated;

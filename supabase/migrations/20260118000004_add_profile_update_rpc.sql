-- ============================================
-- Classification v5.0 - Profile 增量更新 RPC 函数
-- 创建日期: 2026-01-18
-- 说明: 实现文件夹画像的增量更新（指数移动平均）
-- ============================================

-- ============================================
-- RPC 函数 1: 增量更新 content_embedding
-- ============================================

CREATE OR REPLACE FUNCTION update_folder_profile_incremental(
  p_folder_id BIGINT,
  p_new_embedding vector(1024),
  p_learning_rate DECIMAL(3,2) DEFAULT 0.1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_current_embedding vector(1024);
BEGIN
  -- 1. 验证学习率范围
  IF p_learning_rate < 0 OR p_learning_rate > 1 THEN
    RAISE EXCEPTION 'Learning rate must be between 0 and 1, got: %', p_learning_rate;
  END IF;

  -- 2. 获取当前用户ID（安全检查）
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- 3. 验证文件夹所有权
  IF NOT EXISTS (
    SELECT 1 FROM folders
    WHERE id = p_folder_id AND user_id = v_user_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Folder not found or access denied: %', p_folder_id;
  END IF;

  -- 4. 获取当前 content_embedding
  SELECT content_embedding INTO v_current_embedding
  FROM classification_folder_profiles_v5
  WHERE folder_id = p_folder_id AND user_id = v_user_id;

  -- 5. 如果 Profile 不存在，抛出异常
  IF v_current_embedding IS NULL THEN
    RAISE EXCEPTION 'Folder profile not found for folder_id: %', p_folder_id;
  END IF;

  -- 6. 使用指数移动平均更新 content_embedding
  -- 新向量 = (1 - α) * 旧向量 + α * 新向量
  UPDATE classification_folder_profiles_v5
  SET
    content_embedding = (
      (1 - p_learning_rate) * content_embedding +
      p_learning_rate * p_new_embedding
    ),
    updated_at = NOW(),
    last_updated_at = NOW()
  WHERE folder_id = p_folder_id AND user_id = v_user_id;

  -- 7. 记录日志
  RAISE NOTICE 'Updated folder profile for folder_id: %, learning_rate: %', p_folder_id, p_learning_rate;
END;
$$;

COMMENT ON FUNCTION update_folder_profile_incremental IS
'增量更新文件夹 content_embedding，使用指数移动平均算法。用于反馈闭环中的 Profile 强化。';

-- ============================================
-- RPC 函数 2: 批量增量更新（用于批量反馈）
-- ============================================

CREATE OR REPLACE FUNCTION batch_update_folder_profiles(
  p_updates JSONB, -- [{"folder_id": 123, "embedding": [...], "learning_rate": 0.1}, ...]
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
  folder_id BIGINT,
  success BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_update JSONB;
  v_folder_id BIGINT;
  v_embedding vector(1024);
  v_learning_rate DECIMAL(3,2);
BEGIN
  -- 1. 获取用户ID
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- 2. 遍历更新列表
  FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    BEGIN
      -- 提取参数
      v_folder_id := (v_update->>'folder_id')::BIGINT;
      v_embedding := (v_update->>'embedding')::vector(1024);
      v_learning_rate := COALESCE((v_update->>'learning_rate')::DECIMAL(3,2), 0.1);

      -- 调用单个更新函数
      PERFORM update_folder_profile_incremental(
        v_folder_id,
        v_embedding,
        v_learning_rate
      );

      -- 返回成功结果
      RETURN QUERY SELECT v_folder_id, TRUE, NULL::TEXT;

    EXCEPTION WHEN OTHERS THEN
      -- 返回失败结果
      RETURN QUERY SELECT v_folder_id, FALSE, SQLERRM;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION batch_update_folder_profiles IS
'批量增量更新文件夹 Profile，用于处理批量反馈场景。';

-- ============================================
-- RPC 函数 3: 标记文件夹需要更新（Dirty Flag）
-- ============================================

CREATE OR REPLACE FUNCTION increment_folder_dirty_count(
  p_folder_id BIGINT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 增加 change_count，标记为需要更新
  UPDATE classification_folder_profiles_v5
  SET
    needs_update = TRUE,
    updated_at = NOW()
  WHERE folder_id = p_folder_id;

  -- 如果 Profile 不存在，不做任何操作（静默失败）
END;
$$;

COMMENT ON FUNCTION increment_folder_dirty_count IS
'标记文件夹 Profile 需要更新（Dirty Flag），由书签变动触发器调用。';

-- ============================================
-- 授权：允许认证用户调用这些函数
-- ============================================

GRANT EXECUTE ON FUNCTION update_folder_profile_incremental TO authenticated;
GRANT EXECUTE ON FUNCTION batch_update_folder_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION increment_folder_dirty_count TO authenticated;

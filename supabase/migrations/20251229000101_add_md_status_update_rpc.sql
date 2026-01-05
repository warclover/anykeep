-- ============================================================================
-- MD 收藏原子状态更新 RPC 函数
-- 用于防止并发更新冲突，实现乐观锁
-- ============================================================================

-- 创建 MD 收藏状态更新函数
CREATE OR REPLACE FUNCTION update_md_collection_status(
  p_collection_id BIGINT,
  p_user_id UUID,
  p_new_status VARCHAR(20),
  p_update_data JSONB DEFAULT NULL,
  p_expected_status VARCHAR(20) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status VARCHAR(20);
  v_updated_at TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  -- 验证用户权限
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unauthorized',
      'message', '无权限操作此收藏'
    );
  END IF;

  -- 获取当前状态（加锁）
  SELECT processing_status INTO v_current_status
  FROM md_collections
  WHERE id = p_collection_id
    AND user_id = p_user_id
    AND deleted_at IS NULL
  FOR UPDATE;

  -- 检查记录是否存在
  IF v_current_status IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'not_found',
      'message', 'MD 收藏不存在'
    );
  END IF;

  -- 乐观锁检查：如果指定了期望状态，检查当前状态是否匹配
  IF p_expected_status IS NOT NULL AND v_current_status != p_expected_status THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'conflict',
      'message', '状态冲突，当前状态为 ' || v_current_status,
      'current_status', v_current_status
    );
  END IF;

  -- 更新状态
  v_updated_at := NOW();

  UPDATE md_collections
  SET
    processing_status = p_new_status,
    updated_at = v_updated_at,
    -- 从 p_update_data 提取并更新各字段
    ai_summary = COALESCE((p_update_data->>'ai_summary')::TEXT, ai_summary),
    ai_tags = CASE
      WHEN p_update_data ? 'ai_tags' THEN (p_update_data->'ai_tags')::JSONB::TEXT[]
      ELSE ai_tags
    END,
    content_type = COALESCE((p_update_data->>'content_type')::VARCHAR, content_type),
    content_type_confidence = COALESCE((p_update_data->>'content_type_confidence')::REAL, content_type_confidence),
    embedding = CASE
      WHEN p_update_data ? 'embedding' THEN (p_update_data->>'embedding')::VECTOR(1024)
      ELSE embedding
    END,
    embedding_version = COALESCE((p_update_data->>'embedding_version')::VARCHAR, embedding_version),
    processing_error = CASE
      WHEN p_new_status = 'failed' THEN COALESCE((p_update_data->>'processing_error')::TEXT, 'Unknown error')
      WHEN p_new_status = 'completed' THEN NULL
      ELSE processing_error
    END,
    processed_at = CASE
      WHEN p_new_status = 'completed' THEN v_updated_at
      ELSE processed_at
    END
  WHERE id = p_collection_id
    AND user_id = p_user_id;

  -- 返回成功结果
  RETURN jsonb_build_object(
    'success', true,
    'updated_at', v_updated_at,
    'previous_status', v_current_status,
    'new_status', p_new_status
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'internal_error',
      'message', SQLERRM
    );
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION update_md_collection_status IS
  'MD 收藏原子状态更新函数，支持乐观锁和批量字段更新';

-- 创建批量状态重置函数（用于恢复卡住的任务）
CREATE OR REPLACE FUNCTION reset_stuck_md_collections(
  p_user_id UUID,
  p_stuck_threshold_minutes INT DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reset_count INT;
  v_threshold_time TIMESTAMPTZ;
BEGIN
  -- 验证用户权限
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unauthorized'
    );
  END IF;

  -- 计算阈值时间
  v_threshold_time := NOW() - (p_stuck_threshold_minutes || ' minutes')::INTERVAL;

  -- 重置卡住的 processing 状态为 pending
  WITH reset_rows AS (
    UPDATE md_collections
    SET
      processing_status = 'pending',
      processing_error = 'Reset due to stuck processing',
      updated_at = NOW()
    WHERE user_id = p_user_id
      AND processing_status = 'processing'
      AND updated_at < v_threshold_time
      AND deleted_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_reset_count FROM reset_rows;

  RETURN jsonb_build_object(
    'success', true,
    'reset_count', v_reset_count,
    'threshold_time', v_threshold_time
  );
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION reset_stuck_md_collections IS
  '重置卡住的 MD 收藏处理任务（超过指定分钟数的 processing 状态）';

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION update_md_collection_status TO authenticated;
GRANT EXECUTE ON FUNCTION reset_stuck_md_collections TO authenticated;

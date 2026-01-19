-- ============================================
-- Classification v5.0 - 增量更新文件夹 Profile
-- 创建日期: 2026-01-18
-- 说明: 使用学习率增量更新文件夹的向量表示
-- ============================================

-- 先删除旧函数（如果存在）
DROP FUNCTION IF EXISTS update_folder_profile_incremental(BIGINT, vector, DECIMAL);

-- 创建新函数
CREATE OR REPLACE FUNCTION update_folder_profile_incremental(
  p_folder_id BIGINT,
  p_new_embedding vector(1024),
  p_learning_rate DECIMAL(5,4)
)
RETURNS void AS $$
DECLARE
  v_user_id UUID;
  v_current_embedding vector(1024);
  v_updated_embedding vector(1024);
BEGIN
  -- 获取当前用户ID
  v_user_id := auth.uid();

  -- 获取当前文件夹的 Profile 向量
  SELECT profile_embedding
  INTO v_current_embedding
  FROM folder_profiles
  WHERE folder_id = p_folder_id AND user_id = v_user_id;

  -- 如果没有现有 Profile,直接使用新向量
  IF v_current_embedding IS NULL THEN
    v_updated_embedding := p_new_embedding;
  ELSE
    -- 增量更新: new_profile = current_profile + learning_rate * (new_embedding - current_profile)
    -- 简化为: new_profile = (1 - learning_rate) * current_profile + learning_rate * new_embedding
    v_updated_embedding := (
      SELECT array_agg(
        (1 - p_learning_rate) * curr_val + p_learning_rate * new_val
      )::vector(1024)
      FROM unnest(v_current_embedding::real[]) WITH ORDINALITY AS t1(curr_val, idx)
      JOIN unnest(p_new_embedding::real[]) WITH ORDINALITY AS t2(new_val, idx2)
        ON t1.idx = t2.idx2
    );
  END IF;

  -- 更新或插入 Profile
  INSERT INTO folder_profiles (
    user_id,
    folder_id,
    profile_embedding,
    updated_at
  )
  VALUES (
    v_user_id,
    p_folder_id,
    v_updated_embedding,
    NOW()
  )
  ON CONFLICT (user_id, folder_id)
  DO UPDATE SET
    profile_embedding = EXCLUDED.profile_embedding,
    updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_folder_profile_incremental IS '增量更新文件夹 Profile 向量,使用学习率控制更新幅度';

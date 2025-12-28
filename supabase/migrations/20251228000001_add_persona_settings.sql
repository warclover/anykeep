-- =============================================================================
-- Multi-Persona Phase 4: 添加 persona_settings 字段
-- =============================================================================
-- 版本: 1.0.0
-- 日期: 2025-12-28
-- 描述: 为 profiles 表添加 persona_settings 字段，支持用户画像配置持久化
-- =============================================================================

-- 添加 persona_settings 字段到 profiles 表
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS persona_settings JSONB DEFAULT NULL;

-- 添加注释
COMMENT ON COLUMN profiles.persona_settings IS '用户画像设置，包含 primaryType、group、preferences、source 等字段';

-- 添加索引以支持按画像类型查询
CREATE INDEX IF NOT EXISTS idx_profiles_persona_type
ON profiles ((persona_settings->>'primaryType'))
WHERE persona_settings IS NOT NULL;

-- 添加索引以支持按画像分组查询
CREATE INDEX IF NOT EXISTS idx_profiles_persona_group
ON profiles ((persona_settings->>'group'))
WHERE persona_settings IS NOT NULL;

-- =============================================================================
-- RPC 函数：获取画像分布统计
-- =============================================================================
CREATE OR REPLACE FUNCTION get_persona_distribution()
RETURNS TABLE (
  persona_type TEXT,
  persona_group TEXT,
  user_count BIGINT,
  percentage NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH total AS (
    SELECT COUNT(*) as total_count
    FROM profiles
    WHERE persona_settings IS NOT NULL
  ),
  distribution AS (
    SELECT
      persona_settings->>'primaryType' as persona_type,
      persona_settings->>'group' as persona_group,
      COUNT(*) as user_count
    FROM profiles
    WHERE persona_settings IS NOT NULL
    GROUP BY persona_settings->>'primaryType', persona_settings->>'group'
  )
  SELECT
    d.persona_type,
    d.persona_group,
    d.user_count,
    CASE
      WHEN t.total_count > 0 THEN ROUND((d.user_count::NUMERIC / t.total_count) * 100, 2)
      ELSE 0
    END as percentage
  FROM distribution d
  CROSS JOIN total t
  ORDER BY d.user_count DESC;
$$;

-- =============================================================================
-- RPC 函数：更新用户画像设置
-- =============================================================================
CREATE OR REPLACE FUNCTION update_user_persona_settings(
  p_settings JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_result JSONB;
BEGIN
  -- 获取当前用户 ID
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: No authenticated user';
  END IF;

  -- 验证设置结构
  IF p_settings IS NULL THEN
    RAISE EXCEPTION 'Invalid settings: settings cannot be null';
  END IF;

  -- 更新设置
  UPDATE profiles
  SET
    persona_settings = p_settings || jsonb_build_object('updatedAt', NOW()::TEXT),
    updated_at = NOW()
  WHERE id = v_user_id
  RETURNING persona_settings INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  RETURN v_result;
END;
$$;

-- =============================================================================
-- RPC 函数：获取用户画像设置
-- =============================================================================
CREATE OR REPLACE FUNCTION get_user_persona_settings()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_user_id UUID;
  v_result JSONB;
BEGIN
  -- 获取当前用户 ID
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: No authenticated user';
  END IF;

  -- 获取设置
  SELECT persona_settings INTO v_result
  FROM profiles
  WHERE id = v_user_id;

  RETURN v_result;
END;
$$;

-- =============================================================================
-- RPC 函数：清除用户画像设置（重置为 AI 推断）
-- =============================================================================
CREATE OR REPLACE FUNCTION clear_user_persona_settings()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- 获取当前用户 ID
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: No authenticated user';
  END IF;

  -- 清除设置
  UPDATE profiles
  SET
    persona_settings = NULL,
    updated_at = NOW()
  WHERE id = v_user_id;

  RETURN TRUE;
END;
$$;

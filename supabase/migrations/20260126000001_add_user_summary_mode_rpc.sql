-- Migration: Add get/set_user_summary_mode RPC functions
-- Description: Store user summary mode preference in profiles.ai_preferences

-- ============================================================================
-- get_user_summary_mode: 获取用户摘要模式
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_summary_mode(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode TEXT;
BEGIN
  SELECT
    COALESCE(
      ai_preferences->>'summary_mode',
      'standard'
    )
  INTO v_mode
  FROM profiles
  WHERE id = p_user_id;

  -- 验证返回值是有效模式
  IF v_mode NOT IN ('standard', 'enhanced') THEN
    v_mode := 'standard';
  END IF;

  RETURN v_mode;
END;
$$;

-- ============================================================================
-- set_user_summary_mode: 设置用户摘要模式
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_user_summary_mode(
  p_user_id UUID,
  p_mode TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_prefs JSONB;
BEGIN
  -- 验证模式参数
  IF p_mode NOT IN ('standard', 'enhanced') THEN
    RETURN FALSE;
  END IF;

  -- 获取当前 ai_preferences
  SELECT COALESCE(ai_preferences, '{}'::jsonb)
  INTO v_current_prefs
  FROM profiles
  WHERE id = p_user_id;

  -- 如果用户不存在，返回失败
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 更新 summary_mode
  UPDATE profiles
  SET
    ai_preferences = v_current_prefs || jsonb_build_object('summary_mode', p_mode),
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;

-- ============================================================================
-- 权限设置
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_user_summary_mode(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_summary_mode(UUID, TEXT) TO authenticated;

-- ============================================================================
-- 注释
-- ============================================================================
COMMENT ON FUNCTION public.get_user_summary_mode(UUID) IS
  '获取用户的 AI 摘要模式 (standard/enhanced)，默认返回 standard';

COMMENT ON FUNCTION public.set_user_summary_mode(UUID, TEXT) IS
  '设置用户的 AI 摘要模式，成功返回 TRUE，失败返回 FALSE';

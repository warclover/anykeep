-- ===========================================
-- 智能浓缩 v3.0 - 摘要模式配置
-- ===========================================
-- 版本: 1.0.0
-- 日期: 2025-12-14
-- 说明: 在 profiles.settings 中添加 summary_mode 配置
--       支持 'standard' (v2.0) 和 'enhanced' (v3.0) 两种模式

-- -------------------------------------------
-- 1. 更新现有用户的 settings，确保有 summary_mode 字段
-- -------------------------------------------

-- 为所有现有用户添加默认的 summary_mode（如果不存在）
UPDATE public.profiles
SET settings = COALESCE(settings, '{}'::jsonb) || '{"summary_mode": "standard"}'::jsonb
WHERE settings IS NULL OR NOT (settings ? 'summary_mode');

-- -------------------------------------------
-- 2. 创建获取用户摘要模式的函数
-- -------------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_summary_mode(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode TEXT;
BEGIN
  SELECT COALESCE(settings->>'summary_mode', 'standard')
  INTO v_mode
  FROM public.profiles
  WHERE id = p_user_id;

  -- 如果用户不存在或未设置，返回默认值
  IF v_mode IS NULL THEN
    v_mode := 'standard';
  END IF;

  -- 验证值有效性
  IF v_mode NOT IN ('standard', 'enhanced') THEN
    v_mode := 'standard';
  END IF;

  RETURN v_mode;
END;
$$;

COMMENT ON FUNCTION public.get_user_summary_mode IS '获取用户的摘要模式：standard=v2.0标准摘要, enhanced=v3.0智能浓缩';

-- 授权
GRANT EXECUTE ON FUNCTION public.get_user_summary_mode TO authenticated;

-- -------------------------------------------
-- 3. 创建设置用户摘要模式的函数
-- -------------------------------------------

CREATE OR REPLACE FUNCTION public.set_user_summary_mode(p_user_id UUID, p_mode TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 验证模式值
  IF p_mode NOT IN ('standard', 'enhanced') THEN
    RAISE EXCEPTION 'Invalid summary mode: %. Must be "standard" or "enhanced"', p_mode;
  END IF;

  -- 验证用户权限（只能修改自己的配置）
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot modify other user settings';
  END IF;

  -- 更新或插入配置
  UPDATE public.profiles
  SET
    settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('summary_mode', p_mode),
    updated_at = NOW()
  WHERE id = p_user_id;

  -- 如果没有更新任何行，可能是用户不存在
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.set_user_summary_mode IS '设置用户的摘要模式';

-- 授权
GRANT EXECUTE ON FUNCTION public.set_user_summary_mode TO authenticated;

-- -------------------------------------------
-- 4. 添加注释说明
-- -------------------------------------------

COMMENT ON COLUMN public.profiles.settings IS '用户设置 JSON，包含: theme(主题), auto_tag(自动标签), summary_mode(摘要模式: standard/enhanced)';

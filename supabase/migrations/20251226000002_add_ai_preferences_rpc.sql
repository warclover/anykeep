-- =============================================================================
-- Migration: AI 偏好学习 RPC 函数
-- Description: 安全的 JSONB 部分更新函数，支持 AI 偏好学习
-- Version: 1.0.0
-- Date: 2025-12-26
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 添加 ai_preferences 字段到 profiles 表（如果不存在）
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'ai_preferences'
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN ai_preferences JSONB DEFAULT '{
      "responseStyle": "auto",
      "learned": {
        "frequentTags": [],
        "frequentFolders": [],
        "frequentQueries": [],
        "lastUpdated": ""
      },
      "explicit": {
        "skipConfirmation": false,
        "defaultLimit": 10,
        "costSavingMode": false
      },
      "version": 1
    }'::jsonb;

    COMMENT ON COLUMN public.profiles.ai_preferences IS 'AI 偏好配置，包含响应风格、学习偏好、显式设置';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. 创建安全的 RPC 函数：更新 AI 学习偏好
-- -----------------------------------------------------------------------------

-- 删除旧版本（如果存在）
DROP FUNCTION IF EXISTS public.update_ai_learned_preferences(UUID, JSONB);

/**
 * 更新用户 AI 学习偏好（仅更新 learned 部分）
 *
 * 安全特性：
 * - 使用 auth.uid() 验证调用者身份
 * - 只允许更新自己的偏好
 * - 限制 learned 对象大小（防止滥用）
 * - JSONB 部分更新，不覆盖其他字段
 *
 * @param p_user_id - 用户 ID
 * @param p_learned - 学习到的偏好对象
 */
CREATE OR REPLACE FUNCTION public.update_ai_learned_preferences(
  p_user_id UUID,
  p_learned JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id UUID;
  v_learned_size INTEGER;
BEGIN
  -- =========================================================================
  -- 安全检查 1: 验证调用者身份
  -- =========================================================================
  v_current_user_id := auth.uid();

  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_current_user_id != p_user_id THEN
    RAISE EXCEPTION 'You can only update your own preferences'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- =========================================================================
  -- 安全检查 2: 限制输入大小（防止滥用）
  -- =========================================================================
  v_learned_size := length(p_learned::text);

  -- 限制 learned 对象最大 10KB
  IF v_learned_size > 10240 THEN
    RAISE EXCEPTION 'Learned preferences size exceeds limit (max 10KB, got % bytes)', v_learned_size
      USING ERRCODE = 'check_violation';
  END IF;

  -- =========================================================================
  -- 安全检查 3: 验证 learned 对象结构
  -- =========================================================================
  -- 确保必需字段存在
  IF NOT (
    p_learned ? 'frequentTags' AND
    p_learned ? 'frequentFolders' AND
    p_learned ? 'lastUpdated'
  ) THEN
    RAISE EXCEPTION 'Invalid learned preferences structure: missing required fields'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 验证数组字段
  IF jsonb_typeof(p_learned->'frequentTags') != 'array' THEN
    RAISE EXCEPTION 'frequentTags must be an array'
      USING ERRCODE = 'check_violation';
  END IF;

  IF jsonb_typeof(p_learned->'frequentFolders') != 'array' THEN
    RAISE EXCEPTION 'frequentFolders must be an array'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 限制数组长度
  IF jsonb_array_length(p_learned->'frequentTags') > 20 THEN
    RAISE EXCEPTION 'frequentTags exceeds maximum length (max 20)'
      USING ERRCODE = 'check_violation';
  END IF;

  IF jsonb_array_length(p_learned->'frequentFolders') > 10 THEN
    RAISE EXCEPTION 'frequentFolders exceeds maximum length (max 10)'
      USING ERRCODE = 'check_violation';
  END IF;

  -- =========================================================================
  -- 执行更新
  -- =========================================================================
  UPDATE public.profiles
  SET ai_preferences = COALESCE(ai_preferences, '{}'::jsonb) || jsonb_build_object('learned', p_learned)
  WHERE id = p_user_id;

  -- 检查更新是否成功
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found'
      USING ERRCODE = 'no_data_found';
  END IF;
END;
$$;

-- 授权执行
GRANT EXECUTE ON FUNCTION public.update_ai_learned_preferences TO authenticated;

-- 添加注释
COMMENT ON FUNCTION public.update_ai_learned_preferences IS
  '安全更新用户 AI 学习偏好，包含身份验证、大小限制和结构验证';

-- -----------------------------------------------------------------------------
-- 3. 创建索引优化查询
-- -----------------------------------------------------------------------------

-- 为 ai_preferences 中的常用查询路径创建 GIN 索引
CREATE INDEX IF NOT EXISTS idx_profiles_ai_preferences_gin
  ON public.profiles USING GIN (ai_preferences);

-- -----------------------------------------------------------------------------
-- 4. 添加审计日志函数（可选，用于追踪偏好变更）
-- -----------------------------------------------------------------------------

-- 创建偏好变更日志表
CREATE TABLE IF NOT EXISTS public.ai_preferences_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('learned_update', 'explicit_update', 'style_update')),
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ai_preferences_audit_user_time
  ON public.ai_preferences_audit_log (user_id, created_at DESC);

-- RLS 策略
ALTER TABLE public.ai_preferences_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit log"
  ON public.ai_preferences_audit_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- 自动清理旧审计日志（保留 30 天）
CREATE OR REPLACE FUNCTION public.cleanup_old_ai_preferences_audit()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.ai_preferences_audit_log
  WHERE created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- 注释
COMMENT ON TABLE public.ai_preferences_audit_log IS 'AI 偏好变更审计日志';
COMMENT ON FUNCTION public.cleanup_old_ai_preferences_audit IS '清理 30 天前的偏好审计日志';

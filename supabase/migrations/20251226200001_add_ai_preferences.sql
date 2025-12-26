-- Migration: Add AI Preferences to Profiles
-- Version: 1.0.0
-- Date: 2025-12-26
-- Description: 添加用户 AI 偏好持久化字段

-- =============================================================================
-- 添加 ai_preferences JSONB 字段
-- =============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_preferences JSONB DEFAULT '{
  "responseStyle": "auto",
  "learned": {
    "frequentTags": [],
    "frequentFolders": [],
    "frequentQueries": [],
    "lastUpdated": null
  },
  "explicit": {
    "skipConfirmation": false,
    "defaultLimit": 10,
    "costSavingMode": false
  },
  "version": 1
}'::jsonb;

-- =============================================================================
-- 添加 GIN 索引以支持 JSONB 查询
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_ai_preferences
ON public.profiles USING GIN (ai_preferences);

-- =============================================================================
-- 添加部分索引：常用标签快速查询
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_ai_preferences_tags
ON public.profiles USING GIN ((ai_preferences -> 'learned' -> 'frequentTags'));

-- =============================================================================
-- 创建更新学习偏好的 RPC 函数
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_ai_learned_preferences(
  p_user_id UUID,
  p_learned JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET ai_preferences = jsonb_set(
    COALESCE(ai_preferences, '{}'::jsonb),
    '{learned}',
    p_learned
  )
  WHERE id = p_user_id;
END;
$$;

-- =============================================================================
-- 授予权限
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.update_ai_learned_preferences(UUID, JSONB) TO authenticated;

-- =============================================================================
-- 添加注释
-- =============================================================================

COMMENT ON COLUMN public.profiles.ai_preferences IS 'AI 偏好设置：响应风格、学习偏好、显式设置等';

COMMENT ON FUNCTION public.update_ai_learned_preferences IS '更新用户 AI 学习偏好（仅更新 learned 部分）';

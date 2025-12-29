-- Migration: Add Synthesis Recommendation Preferences
-- Version: 1.0.0
-- Date: 2025-12-29
-- Description: 扩展 ai_preferences 以支持综述推荐相关设置

-- =============================================================================
-- 更新 ai_preferences 默认值，添加 synthesisRecommend 配置
-- =============================================================================

-- 为现有用户添加 synthesisRecommend 配置
UPDATE public.profiles
SET ai_preferences = ai_preferences || '{
  "synthesisRecommend": {
    "enabled": false,
    "dismissedTopics": [],
    "lastShownAt": null,
    "dailyShowCount": 0,
    "dailyShowDate": null
  }
}'::jsonb
WHERE ai_preferences IS NOT NULL
  AND ai_preferences -> 'synthesisRecommend' IS NULL;

-- 为没有 ai_preferences 的用户设置默认值
UPDATE public.profiles
SET ai_preferences = '{
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
  "synthesisRecommend": {
    "enabled": false,
    "dismissedTopics": [],
    "lastShownAt": null,
    "dailyShowCount": 0,
    "dailyShowDate": null
  },
  "version": 1
}'::jsonb
WHERE ai_preferences IS NULL;

-- =============================================================================
-- 创建更新综述推荐偏好的 RPC 函数
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_synthesis_recommend_preferences(
  p_user_id UUID,
  p_enabled BOOLEAN DEFAULT NULL,
  p_dismissed_topic TEXT DEFAULT NULL,
  p_increment_daily_count BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_prefs JSONB;
  v_synthesis_prefs JSONB;
  v_dismissed_topics JSONB;
  v_today TEXT;
BEGIN
  -- 获取当前偏好
  SELECT COALESCE(ai_preferences, '{}'::jsonb)
  INTO v_current_prefs
  FROM profiles
  WHERE id = p_user_id;

  -- 获取当前综述推荐偏好
  v_synthesis_prefs := COALESCE(
    v_current_prefs -> 'synthesisRecommend',
    '{"enabled": false, "dismissedTopics": [], "lastShownAt": null, "dailyShowCount": 0, "dailyShowDate": null}'::jsonb
  );

  -- 更新 enabled 状态
  IF p_enabled IS NOT NULL THEN
    v_synthesis_prefs := jsonb_set(v_synthesis_prefs, '{enabled}', to_jsonb(p_enabled));
  END IF;

  -- 添加已忽略的主题
  IF p_dismissed_topic IS NOT NULL THEN
    v_dismissed_topics := COALESCE(v_synthesis_prefs -> 'dismissedTopics', '[]'::jsonb);
    IF NOT v_dismissed_topics ? p_dismissed_topic THEN
      v_dismissed_topics := v_dismissed_topics || to_jsonb(p_dismissed_topic);
      v_synthesis_prefs := jsonb_set(v_synthesis_prefs, '{dismissedTopics}', v_dismissed_topics);
    END IF;
  END IF;

  -- 更新每日显示计数
  IF p_increment_daily_count THEN
    v_today := to_char(NOW(), 'YYYY-MM-DD');

    -- 如果是新的一天，重置计数
    IF (v_synthesis_prefs ->> 'dailyShowDate') IS DISTINCT FROM v_today THEN
      v_synthesis_prefs := jsonb_set(v_synthesis_prefs, '{dailyShowCount}', '1'::jsonb);
      v_synthesis_prefs := jsonb_set(v_synthesis_prefs, '{dailyShowDate}', to_jsonb(v_today));
    ELSE
      -- 否则增加计数
      v_synthesis_prefs := jsonb_set(
        v_synthesis_prefs,
        '{dailyShowCount}',
        to_jsonb(COALESCE((v_synthesis_prefs ->> 'dailyShowCount')::int, 0) + 1)
      );
    END IF;

    -- 更新最后显示时间
    v_synthesis_prefs := jsonb_set(v_synthesis_prefs, '{lastShownAt}', to_jsonb(NOW()::text));
  END IF;

  -- 保存更新
  UPDATE profiles
  SET ai_preferences = jsonb_set(
    COALESCE(ai_preferences, '{}'::jsonb),
    '{synthesisRecommend}',
    v_synthesis_prefs
  )
  WHERE id = p_user_id;

  RETURN v_synthesis_prefs;
END;
$$;

-- =============================================================================
-- 创建获取综述推荐偏好的 RPC 函数
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_synthesis_recommend_preferences(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs JSONB;
  v_today TEXT;
BEGIN
  SELECT COALESCE(
    ai_preferences -> 'synthesisRecommend',
    '{"enabled": false, "dismissedTopics": [], "lastShownAt": null, "dailyShowCount": 0, "dailyShowDate": null}'::jsonb
  )
  INTO v_prefs
  FROM profiles
  WHERE id = p_user_id;

  -- 如果是新的一天，重置每日计数
  v_today := to_char(NOW(), 'YYYY-MM-DD');
  IF (v_prefs ->> 'dailyShowDate') IS DISTINCT FROM v_today THEN
    v_prefs := jsonb_set(v_prefs, '{dailyShowCount}', '0'::jsonb);
  END IF;

  RETURN COALESCE(v_prefs, '{"enabled": false, "dismissedTopics": [], "lastShownAt": null, "dailyShowCount": 0, "dailyShowDate": null}'::jsonb);
END;
$$;

-- =============================================================================
-- 授予权限
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.update_synthesis_recommend_preferences(UUID, BOOLEAN, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_synthesis_recommend_preferences(UUID) TO authenticated;

-- =============================================================================
-- 添加注释
-- =============================================================================

COMMENT ON FUNCTION public.update_synthesis_recommend_preferences IS '更新用户综述推荐偏好（启用/禁用、忽略主题、更新每日计数）';
COMMENT ON FUNCTION public.get_synthesis_recommend_preferences IS '获取用户综述推荐偏好（自动重置过期的每日计数）';

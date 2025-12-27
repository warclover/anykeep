-- ============================================================================
-- AI 记忆系统数据库函数
-- Migration: 20251227000003_add_ai_memory_functions
-- Author: Winston (Architect Agent)
-- Date: 2025-12-27
-- ============================================================================

-- ============================================================================
-- 获取最近会话摘要
-- ============================================================================

CREATE OR REPLACE FUNCTION get_recent_summaries(
  p_user_id UUID,
  p_limit INT DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  session_id UUID,
  summary TEXT,
  intents TEXT[],
  actions JSONB,
  pending_intents TEXT[],
  message_count INT,
  sentiment TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.session_id,
    s.summary,
    s.intents,
    s.actions,
    s.pending_intents,
    s.message_count,
    s.sentiment,
    s.created_at
  FROM ai_conversation_summaries s
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_recent_summaries IS '获取用户最近的会话摘要，用于情景记忆注入';

-- ============================================================================
-- 获取未完成意图（跨会话汇总）
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pending_intents(p_user_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result TEXT[] := '{}';
BEGIN
  -- 从最近 7 天的摘要中提取未完成意图，去重
  SELECT COALESCE(array_agg(DISTINCT intent), '{}')
  INTO result
  FROM ai_conversation_summaries s,
       unnest(s.pending_intents) AS intent
  WHERE s.user_id = p_user_id
    AND s.created_at > NOW() - INTERVAL '7 days'
    AND array_length(s.pending_intents, 1) > 0;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_pending_intents IS '获取用户最近 7 天内未完成的意图列表';

-- ============================================================================
-- 移除已完成的意图
-- ============================================================================

CREATE OR REPLACE FUNCTION remove_pending_intent(
  p_user_id UUID,
  p_intent TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 从最近 7 天的摘要中移除指定意图
  UPDATE ai_conversation_summaries
  SET pending_intents = array_remove(pending_intents, p_intent)
  WHERE user_id = p_user_id
    AND created_at > NOW() - INTERVAL '7 days'
    AND p_intent = ANY(pending_intents);
END;
$$;

COMMENT ON FUNCTION remove_pending_intent IS '标记某个意图为已完成，从所有摘要中移除';

-- ============================================================================
-- 分析用户偏好（基于交互日志）
-- ============================================================================

CREATE OR REPLACE FUNCTION analyze_user_preferences(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB := '{}';
  positive_count INT := 0;
  negative_count INT := 0;
  total_count INT := 0;
  common_actions TEXT[] := '{}';
  positive_rate FLOAT := 0.5;
BEGIN
  -- 统计最近 30 天的正面/负面反馈
  SELECT
    COUNT(*) FILTER (WHERE user_feedback = 'positive'),
    COUNT(*) FILTER (WHERE user_feedback = 'negative'),
    COUNT(*)
  INTO positive_count, negative_count, total_count
  FROM ai_interaction_logs
  WHERE user_id = p_user_id
    AND created_at > NOW() - INTERVAL '30 days'
    AND user_feedback IS NOT NULL;

  -- 计算正面反馈率
  IF (positive_count + negative_count) > 0 THEN
    positive_rate := positive_count::FLOAT / (positive_count + negative_count);
  END IF;

  -- 获取最常用的操作类型 (Top 3)
  SELECT COALESCE(array_agg(action_type ORDER BY cnt DESC), '{}')
  INTO common_actions
  FROM (
    SELECT action_type, COUNT(*) as cnt
    FROM ai_interaction_logs
    WHERE user_id = p_user_id
      AND created_at > NOW() - INTERVAL '30 days'
    GROUP BY action_type
    ORDER BY cnt DESC
    LIMIT 3
  ) sub;

  -- 构建结果
  result := jsonb_build_object(
    'positiveRate', positive_rate,
    'commonActions', common_actions,
    'totalInteractions', total_count,
    'positiveCount', positive_count,
    'negativeCount', negative_count
  );

  RETURN result;
END;
$$;

COMMENT ON FUNCTION analyze_user_preferences IS '分析用户的 AI 交互偏好，包括接受率和常用操作';

-- ============================================================================
-- 获取用户交互统计
-- ============================================================================

CREATE OR REPLACE FUNCTION get_interaction_stats(
  p_user_id UUID,
  p_days INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB := '{}';
BEGIN
  SELECT jsonb_build_object(
    'totalInteractions', COUNT(*),
    'byType', jsonb_object_agg(
      COALESCE(action_type, 'unknown'),
      type_count
    ),
    'byFeedback', jsonb_build_object(
      'positive', COUNT(*) FILTER (WHERE user_feedback = 'positive'),
      'negative', COUNT(*) FILTER (WHERE user_feedback = 'negative'),
      'modified', COUNT(*) FILTER (WHERE user_feedback = 'modified'),
      'none', COUNT(*) FILTER (WHERE user_feedback IS NULL)
    ),
    'periodDays', p_days
  )
  INTO result
  FROM (
    SELECT
      action_type,
      COUNT(*) as type_count,
      user_feedback
    FROM ai_interaction_logs
    WHERE user_id = p_user_id
      AND created_at > NOW() - (p_days || ' days')::INTERVAL
    GROUP BY action_type, user_feedback
  ) stats;

  RETURN COALESCE(result, '{}'::JSONB);
END;
$$;

COMMENT ON FUNCTION get_interaction_stats IS '获取用户指定天数内的交互统计';

-- ============================================================================
-- 清理过期数据
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_ai_memory(
  p_summary_days INT DEFAULT 90,
  p_log_days INT DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_summaries INT := 0;
  deleted_logs INT := 0;
BEGIN
  -- 清理过期摘要
  WITH deleted AS (
    DELETE FROM ai_conversation_summaries
    WHERE created_at < NOW() - (p_summary_days || ' days')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_summaries FROM deleted;

  -- 清理过期日志
  WITH deleted AS (
    DELETE FROM ai_interaction_logs
    WHERE created_at < NOW() - (p_log_days || ' days')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_logs FROM deleted;

  RETURN jsonb_build_object(
    'deletedSummaries', deleted_summaries,
    'deletedLogs', deleted_logs,
    'summaryRetentionDays', p_summary_days,
    'logRetentionDays', p_log_days
  );
END;
$$;

COMMENT ON FUNCTION cleanup_old_ai_memory IS '清理过期的 AI 记忆数据，默认保留摘要 90 天、日志 60 天';

-- ============================================================================
-- 授权
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_recent_summaries TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_intents TO authenticated;
GRANT EXECUTE ON FUNCTION remove_pending_intent TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_user_preferences TO authenticated;
GRANT EXECUTE ON FUNCTION get_interaction_stats TO authenticated;
-- cleanup_old_ai_memory 不授权给普通用户，仅管理员/定时任务使用

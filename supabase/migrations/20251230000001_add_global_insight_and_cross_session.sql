-- =============================================================================
-- Migration: Add Global Insight and Cross-Session Memory
-- Description: Phase 1 - 全局洞察服务和跨会话记忆支持
-- Version: AI Secretary Evolution Phase 1
-- Date: 2025-12-30
-- =============================================================================

-- =============================================================================
-- 1. 扩展 ai_session_memory 表：添加跨会话字段
-- =============================================================================

-- 添加上次会话摘要字段
ALTER TABLE public.ai_session_memory
ADD COLUMN IF NOT EXISTS previous_session_summary JSONB;

-- 添加当前关注点字段
ALTER TABLE public.ai_session_memory
ADD COLUMN IF NOT EXISTS current_focus JSONB;

COMMENT ON COLUMN public.ai_session_memory.previous_session_summary IS '上次会话摘要，用于跨会话记忆';
COMMENT ON COLUMN public.ai_session_memory.current_focus IS '用户当前关注点';

-- =============================================================================
-- 2. 创建意图历史表 (ai_intent_history)
-- 用途: 记录用户意图历史，支持意图预测
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_intent_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 意图信息
    intent_type TEXT NOT NULL,
    intent_sub_type TEXT,
    confidence FLOAT,

    -- 执行结果
    success BOOLEAN DEFAULT TRUE,
    satisfaction INT CHECK (satisfaction >= 1 AND satisfaction <= 5),

    -- 上下文
    message_preview TEXT,  -- 消息前 100 字符
    context JSONB DEFAULT '{}',

    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_intent_history_user_time
    ON public.ai_intent_history(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_intent_history_intent
    ON public.ai_intent_history(user_id, intent_type, intent_sub_type);

-- RLS 策略
ALTER TABLE public.ai_intent_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own intent history"
    ON public.ai_intent_history FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert intent history"
    ON public.ai_intent_history FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- 注释
COMMENT ON TABLE public.ai_intent_history IS '用户意图历史表 - 记录意图用于预测和分析';
COMMENT ON COLUMN public.ai_intent_history.message_preview IS '消息预览，前 100 字符';
COMMENT ON COLUMN public.ai_intent_history.satisfaction IS '用户满意度 1-5';

-- =============================================================================
-- 3. RPC 函数：更新全局洞察
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_ai_global_insight(
    p_user_id UUID,
    p_insight JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.profiles
    SET ai_preferences = jsonb_set(
        COALESCE(ai_preferences, '{}'::JSONB),
        '{globalInsight}',
        p_insight
    )
    WHERE id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.update_ai_global_insight(UUID, JSONB) IS '更新用户的全局洞察数据';

-- =============================================================================
-- 4. RPC 函数：更新跨会话记忆
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_session_cross_memory(
    p_user_id UUID,
    p_conversation_id TEXT,
    p_previous_summary JSONB,
    p_current_focus JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.ai_session_memory
    SET
        previous_session_summary = p_previous_summary,
        current_focus = COALESCE(p_current_focus, current_focus),
        updated_at = NOW()
    WHERE user_id = p_user_id AND conversation_id = p_conversation_id;
END;
$$;

COMMENT ON FUNCTION public.update_session_cross_memory(UUID, TEXT, JSONB, JSONB) IS '更新会话的跨会话记忆数据';

-- =============================================================================
-- 5. RPC 函数：记录意图历史
-- =============================================================================

CREATE OR REPLACE FUNCTION public.record_intent_history(
    p_user_id UUID,
    p_intent_type TEXT,
    p_intent_sub_type TEXT DEFAULT NULL,
    p_confidence FLOAT DEFAULT NULL,
    p_success BOOLEAN DEFAULT TRUE,
    p_message_preview TEXT DEFAULT NULL,
    p_context JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.ai_intent_history (
        user_id,
        intent_type,
        intent_sub_type,
        confidence,
        success,
        message_preview,
        context
    )
    VALUES (
        p_user_id,
        p_intent_type,
        p_intent_sub_type,
        p_confidence,
        p_success,
        LEFT(p_message_preview, 100),  -- 截取前 100 字符
        p_context
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.record_intent_history IS '记录用户意图到历史表';

-- =============================================================================
-- 6. RPC 函数：获取用户意图统计
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_intent_stats(
    p_user_id UUID,
    p_days INT DEFAULT 30
)
RETURNS TABLE (
    intent_type TEXT,
    intent_sub_type TEXT,
    count BIGINT,
    success_count BIGINT,
    avg_confidence FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ih.intent_type,
        ih.intent_sub_type,
        COUNT(*) AS count,
        COUNT(*) FILTER (WHERE ih.success = TRUE) AS success_count,
        AVG(ih.confidence) AS avg_confidence
    FROM public.ai_intent_history ih
    WHERE ih.user_id = p_user_id
        AND ih.created_at >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY ih.intent_type, ih.intent_sub_type
    ORDER BY count DESC;
END;
$$;

COMMENT ON FUNCTION public.get_intent_stats(UUID, INT) IS '获取用户意图统计数据';

-- =============================================================================
-- 7. RPC 函数：清理过期意图历史
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_intent_history(p_days INT DEFAULT 30)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM public.ai_intent_history
    WHERE created_at < NOW() - (p_days || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_intent_history(INT) IS '清理指定天数前的意图历史';

-- =============================================================================
-- 8. RPC 函数：获取全局洞察
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_ai_global_insight(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_insight JSONB;
BEGIN
    SELECT ai_preferences->'globalInsight'
    INTO v_insight
    FROM public.profiles
    WHERE id = p_user_id;

    RETURN v_insight;
END;
$$;

COMMENT ON FUNCTION public.get_ai_global_insight(UUID) IS '获取用户的全局洞察数据';

-- =============================================================================
-- 9. RPC 函数：获取用户上次会话摘要
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_last_session_summary(
    p_user_id UUID,
    p_exclude_conversation_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    conversation_id TEXT,
    previous_session_summary JSONB,
    current_focus JSONB,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        asm.conversation_id,
        asm.previous_session_summary,
        asm.current_focus,
        asm.updated_at
    FROM public.ai_session_memory asm
    WHERE asm.user_id = p_user_id
        AND (p_exclude_conversation_id IS NULL OR asm.conversation_id != p_exclude_conversation_id)
        AND asm.expires_at > NOW()
        AND asm.previous_session_summary IS NOT NULL
    ORDER BY asm.updated_at DESC
    LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_last_session_summary(UUID, TEXT) IS '获取用户上次会话的摘要';

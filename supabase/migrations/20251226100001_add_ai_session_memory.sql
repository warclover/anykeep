-- =============================================================================
-- Migration: Add AI Session Memory Table
-- Description: 支持会话记忆持久化，服务重启后可恢复会话上下文
-- Version: Phase 4 - Issue #2
-- Date: 2025-12-26
-- =============================================================================

-- =============================================================================
-- 1. AI 会话记忆表 (ai_session_memory)
-- 用途: 持久化存储会话状态，支持跨会话上下文
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_session_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 会话标识
    conversation_id TEXT NOT NULL,

    -- 会话状态（JSONB 存储完整 ConversationState）
    state JSONB NOT NULL DEFAULT '{}',

    -- 元数据
    message_count INT NOT NULL DEFAULT 0,
    last_intent TEXT,

    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

    -- 唯一约束：每个用户的每个会话只有一条记录
    CONSTRAINT ai_session_memory_unique UNIQUE (user_id, conversation_id)
);

-- 索引优化
CREATE INDEX idx_ai_session_memory_user ON public.ai_session_memory(user_id);
CREATE INDEX idx_ai_session_memory_conversation ON public.ai_session_memory(conversation_id);
-- 注意: 不能使用 WHERE expires_at > NOW() 部分索引，因为 NOW() 不是 IMMUTABLE 函数
CREATE INDEX idx_ai_session_memory_expires ON public.ai_session_memory(expires_at);
CREATE INDEX idx_ai_session_memory_updated ON public.ai_session_memory(updated_at DESC);

-- RLS 策略
ALTER TABLE public.ai_session_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session memory"
    ON public.ai_session_memory
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own session memory"
    ON public.ai_session_memory
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own session memory"
    ON public.ai_session_memory
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own session memory"
    ON public.ai_session_memory
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- =============================================================================
-- 2. 更新时间戳触发器
-- =============================================================================

CREATE OR REPLACE FUNCTION update_ai_session_memory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    -- 每次更新时延长过期时间
    NEW.expires_at = NOW() + INTERVAL '7 days';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ai_session_memory_timestamp ON public.ai_session_memory;
CREATE TRIGGER trigger_update_ai_session_memory_timestamp
    BEFORE UPDATE ON public.ai_session_memory
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_session_memory_timestamp();

-- =============================================================================
-- 3. 辅助函数
-- =============================================================================

-- 获取或创建会话记忆
CREATE OR REPLACE FUNCTION get_or_create_session_memory(
    p_user_id UUID,
    p_conversation_id TEXT
)
RETURNS public.ai_session_memory AS $$
DECLARE
    v_record public.ai_session_memory;
BEGIN
    -- 尝试获取现有记录
    SELECT * INTO v_record
    FROM public.ai_session_memory
    WHERE user_id = p_user_id
        AND conversation_id = p_conversation_id
        AND expires_at > NOW();

    IF FOUND THEN
        RETURN v_record;
    END IF;

    -- 创建新记录
    INSERT INTO public.ai_session_memory (user_id, conversation_id, state)
    VALUES (p_user_id, p_conversation_id, '{}')
    ON CONFLICT (user_id, conversation_id)
    DO UPDATE SET
        updated_at = NOW(),
        expires_at = NOW() + INTERVAL '7 days'
    RETURNING * INTO v_record;

    RETURN v_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 保存会话状态
CREATE OR REPLACE FUNCTION save_session_state(
    p_user_id UUID,
    p_conversation_id TEXT,
    p_state JSONB,
    p_message_count INT DEFAULT 0,
    p_last_intent TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO public.ai_session_memory (
        user_id,
        conversation_id,
        state,
        message_count,
        last_intent
    )
    VALUES (
        p_user_id,
        p_conversation_id,
        p_state,
        p_message_count,
        p_last_intent
    )
    ON CONFLICT (user_id, conversation_id)
    DO UPDATE SET
        state = p_state,
        message_count = p_message_count,
        last_intent = p_last_intent,
        updated_at = NOW(),
        expires_at = NOW() + INTERVAL '7 days';

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 清理过期会话
CREATE OR REPLACE FUNCTION cleanup_expired_session_memory()
RETURNS INT AS $$
DECLARE
    v_deleted INT;
BEGIN
    DELETE FROM public.ai_session_memory
    WHERE expires_at < NOW();

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- 获取用户活跃会话数
CREATE OR REPLACE FUNCTION get_user_active_sessions(p_user_id UUID)
RETURNS TABLE (
    conversation_id TEXT,
    message_count INT,
    last_intent TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    expires_in INTERVAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        asm.conversation_id,
        asm.message_count,
        asm.last_intent,
        asm.created_at,
        asm.updated_at,
        (asm.expires_at - NOW()) AS expires_in
    FROM public.ai_session_memory asm
    WHERE asm.user_id = p_user_id
        AND asm.expires_at > NOW()
    ORDER BY asm.updated_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- 4. 注释
-- =============================================================================

COMMENT ON TABLE public.ai_session_memory IS 'AI 会话记忆表 - 持久化存储会话状态，支持服务重启后恢复上下文';
COMMENT ON COLUMN public.ai_session_memory.conversation_id IS '会话 ID，用于标识不同的对话';
COMMENT ON COLUMN public.ai_session_memory.state IS '完整的会话状态（ConversationState），包含消息历史、提及实体等';
COMMENT ON COLUMN public.ai_session_memory.message_count IS '消息数量，用于快速统计';
COMMENT ON COLUMN public.ai_session_memory.last_intent IS '最近的意图类型，用于快速筛选';
COMMENT ON COLUMN public.ai_session_memory.expires_at IS '过期时间，默认 7 天后过期';

COMMENT ON FUNCTION get_or_create_session_memory(UUID, TEXT) IS '获取或创建会话记忆记录';
COMMENT ON FUNCTION save_session_state(UUID, TEXT, JSONB, INT, TEXT) IS '保存会话状态到数据库';
COMMENT ON FUNCTION cleanup_expired_session_memory() IS '清理过期的会话记忆';
COMMENT ON FUNCTION get_user_active_sessions(UUID) IS '获取用户的活跃会话列表';

-- =============================================================================
-- Migration: Add AI Interaction Tables for Phase 4
-- Description: 支持 AI 交互 UI 升级（反馈收集、操作快照、笔记保存）
-- Version: Phase 4 - Batch 7B.1
-- Date: 2025-12-25
-- =============================================================================

-- =============================================================================
-- 1. AI 反馈表 (ai_feedback)
-- 用途: 收集用户对 AI 回答的 👍👎 反馈，支持 Batch 6 自我进化
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 消息关联
    conversation_id TEXT NOT NULL,
    message_id TEXT NOT NULL,

    -- 反馈类型
    type TEXT NOT NULL CHECK (type IN ('positive', 'negative')),

    -- 负反馈详情
    negative_reason TEXT CHECK (
        negative_reason IS NULL OR
        negative_reason IN ('wrong_intent', 'inaccurate_result', 'bad_format', 'incomplete', 'other')
    ),
    negative_comment TEXT,

    -- 上下文信息（用于分析和学习）
    original_message TEXT NOT NULL,
    classified_intent TEXT NOT NULL,
    tool_used TEXT NOT NULL,
    execution_mode TEXT CHECK (execution_mode IN ('atomic', 'orchestration')),
    skill_id TEXT,

    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 唯一约束：一个消息只能有一个反馈
    CONSTRAINT ai_feedback_unique_message UNIQUE (user_id, message_id)
);

-- 索引优化
CREATE INDEX idx_ai_feedback_user ON public.ai_feedback(user_id);
CREATE INDEX idx_ai_feedback_created ON public.ai_feedback(created_at DESC);
CREATE INDEX idx_ai_feedback_type ON public.ai_feedback(type);
CREATE INDEX idx_ai_feedback_conversation ON public.ai_feedback(conversation_id);
CREATE INDEX idx_ai_feedback_intent ON public.ai_feedback(classified_intent)
    WHERE type = 'negative' AND negative_reason = 'wrong_intent';

-- RLS 策略
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedback"
    ON public.ai_feedback
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own feedback"
    ON public.ai_feedback
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feedback"
    ON public.ai_feedback
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- 2. AI 操作快照表 (ai_operation_snapshots)
-- 用途: 支持 AI 操作的撤销功能（24 小时内有效）
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_operation_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 操作类型
    operation_type TEXT NOT NULL CHECK (
        operation_type IN ('organize', 'batch_tag', 'dedupe', 'move', 'archive', 'delete')
    ),

    -- 关联信息
    conversation_id TEXT,
    skill_id TEXT,

    -- 受影响的书签
    bookmark_ids BIGINT[] NOT NULL DEFAULT '{}',

    -- 操作前后状态（用于回滚）
    before_state JSONB NOT NULL DEFAULT '[]',
    after_state JSONB NOT NULL DEFAULT '[]',

    -- 操作详情
    operations JSONB NOT NULL DEFAULT '[]',
    summary TEXT,

    -- 撤销状态
    is_reverted BOOLEAN NOT NULL DEFAULT FALSE,
    reverted_at TIMESTAMPTZ,

    -- 时间管理
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),

    -- 约束
    CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- 索引优化
CREATE INDEX idx_ai_snapshots_user ON public.ai_operation_snapshots(user_id);
CREATE INDEX idx_ai_snapshots_user_created ON public.ai_operation_snapshots(user_id, created_at DESC);
CREATE INDEX idx_ai_snapshots_expires ON public.ai_operation_snapshots(expires_at)
    WHERE is_reverted = FALSE;
CREATE INDEX idx_ai_snapshots_conversation ON public.ai_operation_snapshots(conversation_id)
    WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_ai_snapshots_type ON public.ai_operation_snapshots(user_id, operation_type);

-- RLS 策略
ALTER TABLE public.ai_operation_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai snapshots"
    ON public.ai_operation_snapshots
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own ai snapshots"
    ON public.ai_operation_snapshots
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ai snapshots"
    ON public.ai_operation_snapshots
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- 3. AI 笔记表 (ai_notes)
-- 用途: 保存 AI 生成的内容（总结、萃取、复习笔记）
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 来源类型
    source_type TEXT NOT NULL CHECK (
        source_type IN ('ai_summary', 'ai_extraction', 'ai_review', 'ai_report', 'ai_response')
    ),

    -- 内容
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    content_format TEXT NOT NULL DEFAULT 'markdown' CHECK (
        content_format IN ('markdown', 'html', 'plain', 'json')
    ),

    -- 关联书签
    related_bookmark_ids BIGINT[] DEFAULT '{}',

    -- 关联会话
    source_conversation_id TEXT,
    source_message_id TEXT,
    source_skill_id TEXT,

    -- 标签
    tags TEXT[] DEFAULT '{}',

    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引优化
CREATE INDEX idx_ai_notes_user ON public.ai_notes(user_id);
CREATE INDEX idx_ai_notes_created ON public.ai_notes(created_at DESC);
CREATE INDEX idx_ai_notes_source ON public.ai_notes(source_type);
CREATE INDEX idx_ai_notes_tags ON public.ai_notes USING GIN(tags);
CREATE INDEX idx_ai_notes_bookmarks ON public.ai_notes USING GIN(related_bookmark_ids);

-- 全文搜索索引
ALTER TABLE public.ai_notes ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(content, '')), 'B')
    ) STORED;

CREATE INDEX idx_ai_notes_search ON public.ai_notes USING GIN(search_vector);

-- RLS 策略
ALTER TABLE public.ai_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai notes"
    ON public.ai_notes
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own ai notes"
    ON public.ai_notes
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ai notes"
    ON public.ai_notes
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own ai notes"
    ON public.ai_notes
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- =============================================================================
-- 4. 辅助函数
-- =============================================================================

-- 获取用户可撤销的 AI 操作
CREATE OR REPLACE FUNCTION get_undoable_ai_operations(
    p_user_id UUID,
    p_limit INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    operation_type TEXT,
    bookmark_count INT,
    summary TEXT,
    created_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    time_remaining INTERVAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        aos.id,
        aos.operation_type,
        array_length(aos.bookmark_ids, 1) AS bookmark_count,
        aos.summary,
        aos.created_at,
        aos.expires_at,
        (aos.expires_at - NOW()) AS time_remaining
    FROM public.ai_operation_snapshots aos
    WHERE aos.user_id = p_user_id
        AND NOT aos.is_reverted
        AND aos.expires_at > NOW()
    ORDER BY aos.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 撤销 AI 操作
CREATE OR REPLACE FUNCTION undo_ai_operation(
    p_snapshot_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    restored_count INT,
    message TEXT
) AS $$
DECLARE
    v_snapshot RECORD;
    v_restored INT := 0;
    v_bookmark_state JSONB;
BEGIN
    -- 获取快照
    SELECT * INTO v_snapshot
    FROM public.ai_operation_snapshots
    WHERE id = p_snapshot_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, 'Snapshot not found'::TEXT;
        RETURN;
    END IF;

    IF v_snapshot.is_reverted THEN
        RETURN QUERY SELECT FALSE, 0, 'Already reverted'::TEXT;
        RETURN;
    END IF;

    IF v_snapshot.expires_at < NOW() THEN
        RETURN QUERY SELECT FALSE, 0, 'Snapshot expired'::TEXT;
        RETURN;
    END IF;

    -- 恢复每个书签的状态
    FOR v_bookmark_state IN SELECT * FROM jsonb_array_elements(v_snapshot.before_state)
    LOOP
        UPDATE public.bookmarks
        SET
            folder_id = (v_bookmark_state->>'folder_id')::BIGINT,
            tags = ARRAY(SELECT jsonb_array_elements_text(v_bookmark_state->'tags')),
            updated_at = NOW()
        WHERE id = (v_bookmark_state->>'id')::BIGINT
            AND user_id = p_user_id;

        IF FOUND THEN
            v_restored := v_restored + 1;
        END IF;
    END LOOP;

    -- 标记快照为已撤销
    UPDATE public.ai_operation_snapshots
    SET
        is_reverted = TRUE,
        reverted_at = NOW()
    WHERE id = p_snapshot_id;

    RETURN QUERY SELECT TRUE, v_restored, format('Restored %s bookmarks', v_restored)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取反馈统计
CREATE OR REPLACE FUNCTION get_ai_feedback_stats(p_user_id UUID)
RETURNS TABLE (
    total_count INT,
    positive_count INT,
    negative_count INT,
    satisfaction_rate NUMERIC(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INT AS total_count,
        COUNT(*) FILTER (WHERE type = 'positive')::INT AS positive_count,
        COUNT(*) FILTER (WHERE type = 'negative')::INT AS negative_count,
        CASE
            WHEN COUNT(*) > 0 THEN
                ROUND(COUNT(*) FILTER (WHERE type = 'positive')::NUMERIC / COUNT(*) * 100, 2)
            ELSE 0
        END AS satisfaction_rate
    FROM public.ai_feedback
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- 获取负反馈原因分布（用于改进）
CREATE OR REPLACE FUNCTION get_negative_feedback_reasons(
    p_limit INT DEFAULT 100
)
RETURNS TABLE (
    reason TEXT,
    count INT,
    percentage NUMERIC(5,2)
) AS $$
DECLARE
    v_total INT;
BEGIN
    SELECT COUNT(*) INTO v_total
    FROM public.ai_feedback
    WHERE type = 'negative' AND negative_reason IS NOT NULL;

    IF v_total = 0 THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        af.negative_reason,
        COUNT(*)::INT,
        ROUND(COUNT(*)::NUMERIC / v_total * 100, 2)
    FROM public.ai_feedback af
    WHERE af.type = 'negative' AND af.negative_reason IS NOT NULL
    GROUP BY af.negative_reason
    ORDER BY COUNT(*) DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- 更新笔记时间戳触发器
CREATE OR REPLACE FUNCTION update_ai_note_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ai_note_timestamp ON public.ai_notes;
CREATE TRIGGER trigger_update_ai_note_timestamp
    BEFORE UPDATE ON public.ai_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_note_timestamp();

-- =============================================================================
-- 5. 过期数据清理
-- =============================================================================

-- 清理过期快照的函数
CREATE OR REPLACE FUNCTION cleanup_expired_ai_snapshots()
RETURNS INT AS $$
DECLARE
    v_deleted INT;
BEGIN
    DELETE FROM public.ai_operation_snapshots
    WHERE expires_at < NOW() AND is_reverted = FALSE;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- 注意：需要在 Supabase Dashboard 或通过 pg_cron 配置定时任务
-- SELECT cron.schedule(
--   'cleanup-ai-snapshots',
--   '0 4 * * *',  -- 每天凌晨 4 点
--   $$SELECT cleanup_expired_ai_snapshots()$$
-- );

-- =============================================================================
-- 6. 注释
-- =============================================================================

COMMENT ON TABLE public.ai_feedback IS 'AI 反馈表 - 收集用户对 AI 回答的满意度反馈';
COMMENT ON COLUMN public.ai_feedback.type IS '反馈类型: positive(有帮助), negative(无帮助)';
COMMENT ON COLUMN public.ai_feedback.negative_reason IS '负反馈原因: wrong_intent/inaccurate_result/bad_format/incomplete/other';
COMMENT ON COLUMN public.ai_feedback.classified_intent IS 'AI 分类的意图类型，用于改进意图识别';

COMMENT ON TABLE public.ai_operation_snapshots IS 'AI 操作快照表 - 支持 24 小时内撤销';
COMMENT ON COLUMN public.ai_operation_snapshots.operation_type IS '操作类型: organize/batch_tag/dedupe/move/archive/delete';
COMMENT ON COLUMN public.ai_operation_snapshots.before_state IS '操作前书签状态数组 [{id, folder_id, tags}, ...]';
COMMENT ON COLUMN public.ai_operation_snapshots.expires_at IS '过期时间，默认 24 小时后';

COMMENT ON TABLE public.ai_notes IS 'AI 笔记表 - 保存 AI 生成的内容';
COMMENT ON COLUMN public.ai_notes.source_type IS '来源类型: ai_summary/ai_extraction/ai_review/ai_report/ai_response';
COMMENT ON COLUMN public.ai_notes.content_format IS '内容格式: markdown/html/plain/json';

COMMENT ON FUNCTION get_undoable_ai_operations(UUID, INT) IS '获取用户可撤销的 AI 操作列表';
COMMENT ON FUNCTION undo_ai_operation(UUID, UUID) IS '撤销指定的 AI 操作，恢复书签到操作前状态';
COMMENT ON FUNCTION get_ai_feedback_stats(UUID) IS '获取用户的 AI 反馈统计';
COMMENT ON FUNCTION get_negative_feedback_reasons(INT) IS '获取负反馈原因分布，用于改进 AI';
COMMENT ON FUNCTION cleanup_expired_ai_snapshots() IS '清理过期的 AI 操作快照';

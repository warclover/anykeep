-- =============================================================================
-- Migration: Add AI Interaction Tables for Phase 4 (Idempotent Fix)
-- Description: 支持 AI 交互 UI 升级（反馈收集、操作快照、笔记保存）
-- =============================================================================

-- 1. AI Feedback
CREATE TABLE IF NOT EXISTS public.ai_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 安全添加字段
DO $$
BEGIN
    BEGIN ALTER TABLE public.ai_feedback ADD COLUMN conversation_id TEXT NOT NULL DEFAULT ''; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_feedback ADD COLUMN message_id TEXT NOT NULL DEFAULT ''; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_feedback ADD COLUMN type TEXT NOT NULL DEFAULT 'positive' CHECK (type IN ('positive', 'negative')); EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_feedback ADD COLUMN negative_reason TEXT CHECK (negative_reason IS NULL OR negative_reason IN ('wrong_intent', 'inaccurate_result', 'bad_format', 'incomplete', 'other')); EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_feedback ADD COLUMN negative_comment TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_feedback ADD COLUMN original_message TEXT NOT NULL DEFAULT ''; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_feedback ADD COLUMN classified_intent TEXT NOT NULL DEFAULT ''; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_feedback ADD COLUMN tool_used TEXT NOT NULL DEFAULT ''; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_feedback ADD COLUMN execution_mode TEXT CHECK (execution_mode IN ('atomic', 'orchestration')); EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_feedback ADD COLUMN skill_id TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_feedback ADD CONSTRAINT ai_feedback_unique_message UNIQUE (user_id, message_id); EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 索引
CREATE INDEX IF NOT EXISTS idx_ai_feedback_user ON public.ai_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_created ON public.ai_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_type ON public.ai_feedback(type);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_conversation ON public.ai_feedback(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_intent ON public.ai_feedback(classified_intent) WHERE type = 'negative' AND negative_reason = 'wrong_intent';

-- RLS
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own feedback" ON public.ai_feedback;
CREATE POLICY "Users can view own feedback" ON public.ai_feedback FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own feedback" ON public.ai_feedback;
CREATE POLICY "Users can create own feedback" ON public.ai_feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own feedback" ON public.ai_feedback;
CREATE POLICY "Users can update own feedback" ON public.ai_feedback FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. AI Operation Snapshots
CREATE TABLE IF NOT EXISTS public.ai_operation_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 安全添加字段
DO $$
BEGIN
    BEGIN ALTER TABLE public.ai_operation_snapshots ADD COLUMN operation_type TEXT NOT NULL DEFAULT 'organize' CHECK (operation_type IN ('organize', 'batch_tag', 'dedupe', 'move', 'archive', 'delete')); EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_operation_snapshots ADD COLUMN conversation_id TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_operation_snapshots ADD COLUMN skill_id TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_operation_snapshots ADD COLUMN bookmark_ids BIGINT[] NOT NULL DEFAULT '{}'; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_operation_snapshots ADD COLUMN before_state JSONB NOT NULL DEFAULT '[]'; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_operation_snapshots ADD COLUMN after_state JSONB NOT NULL DEFAULT '[]'; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_operation_snapshots ADD COLUMN operations JSONB NOT NULL DEFAULT '[]'; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_operation_snapshots ADD COLUMN summary TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_operation_snapshots ADD COLUMN is_reverted BOOLEAN NOT NULL DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_operation_snapshots ADD COLUMN reverted_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_operation_snapshots ADD COLUMN expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'); EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_operation_snapshots ADD CONSTRAINT valid_expiry CHECK (expires_at > created_at); EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 索引
CREATE INDEX IF NOT EXISTS idx_ai_snapshots_user ON public.ai_operation_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_snapshots_user_created ON public.ai_operation_snapshots(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_snapshots_expires ON public.ai_operation_snapshots(expires_at) WHERE is_reverted = FALSE;
CREATE INDEX IF NOT EXISTS idx_ai_snapshots_conversation ON public.ai_operation_snapshots(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_snapshots_type ON public.ai_operation_snapshots(user_id, operation_type);

-- RLS
ALTER TABLE public.ai_operation_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own ai snapshots" ON public.ai_operation_snapshots;
CREATE POLICY "Users can view own ai snapshots" ON public.ai_operation_snapshots FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own ai snapshots" ON public.ai_operation_snapshots;
CREATE POLICY "Users can create own ai snapshots" ON public.ai_operation_snapshots FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own ai snapshots" ON public.ai_operation_snapshots;
CREATE POLICY "Users can update own ai snapshots" ON public.ai_operation_snapshots FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. AI Notes
CREATE TABLE IF NOT EXISTS public.ai_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 安全添加字段
DO $$
BEGIN
    BEGIN ALTER TABLE public.ai_notes ADD COLUMN source_type TEXT NOT NULL DEFAULT 'ai_summary' CHECK (source_type IN ('ai_summary', 'ai_extraction', 'ai_review', 'ai_report', 'ai_response')); EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_notes ADD COLUMN title TEXT NOT NULL DEFAULT ''; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_notes ADD COLUMN content TEXT NOT NULL DEFAULT ''; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_notes ADD COLUMN content_format TEXT NOT NULL DEFAULT 'markdown' CHECK (content_format IN ('markdown', 'html', 'plain', 'json')); EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_notes ADD COLUMN related_bookmark_ids BIGINT[] DEFAULT '{}'; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_notes ADD COLUMN source_conversation_id TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_notes ADD COLUMN source_message_id TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_notes ADD COLUMN source_skill_id TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_notes ADD COLUMN tags TEXT[] DEFAULT '{}'; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_notes ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(); EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.ai_notes ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (setweight(to_tsvector('simple', COALESCE(title, '')), 'A') || setweight(to_tsvector('simple', COALESCE(content, '')), 'B')) STORED; EXCEPTION WHEN duplicate_column THEN NULL; END;
END $$;

-- 索引
CREATE INDEX IF NOT EXISTS idx_ai_notes_user ON public.ai_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_notes_created ON public.ai_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_notes_source ON public.ai_notes(source_type);
CREATE INDEX IF NOT EXISTS idx_ai_notes_tags ON public.ai_notes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_ai_notes_bookmarks ON public.ai_notes USING GIN(related_bookmark_ids);
CREATE INDEX IF NOT EXISTS idx_ai_notes_search ON public.ai_notes USING GIN(search_vector);

-- RLS
ALTER TABLE public.ai_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own ai notes" ON public.ai_notes;
CREATE POLICY "Users can view own ai notes" ON public.ai_notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own ai notes" ON public.ai_notes;
CREATE POLICY "Users can create own ai notes" ON public.ai_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own ai notes" ON public.ai_notes;
CREATE POLICY "Users can update own ai notes" ON public.ai_notes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own ai notes" ON public.ai_notes;
CREATE POLICY "Users can delete own ai notes" ON public.ai_notes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Functions
CREATE OR REPLACE FUNCTION get_undoable_ai_operations(p_user_id UUID, p_limit INT DEFAULT 10)
RETURNS TABLE (id UUID, operation_type TEXT, bookmark_count INT, summary TEXT, created_at TIMESTAMPTZ, expires_at TIMESTAMPTZ, time_remaining INTERVAL) AS $$
BEGIN
    RETURN QUERY
    SELECT aos.id, aos.operation_type, array_length(aos.bookmark_ids, 1) AS bookmark_count, aos.summary, aos.created_at, aos.expires_at, (aos.expires_at - NOW()) AS time_remaining
    FROM public.ai_operation_snapshots aos
    WHERE aos.user_id = p_user_id AND NOT aos.is_reverted AND aos.expires_at > NOW()
    ORDER BY aos.created_at DESC LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION undo_ai_operation(p_snapshot_id UUID, p_user_id UUID)
RETURNS TABLE (success BOOLEAN, restored_count INT, message TEXT) AS $$
DECLARE
    v_snapshot RECORD;
    v_restored INT := 0;
    v_bookmark_state JSONB;
BEGIN
    SELECT * INTO v_snapshot FROM public.ai_operation_snapshots WHERE id = p_snapshot_id AND user_id = p_user_id;
    IF NOT FOUND THEN RETURN QUERY SELECT FALSE, 0, 'Snapshot not found'::TEXT; RETURN; END IF;
    IF v_snapshot.is_reverted THEN RETURN QUERY SELECT FALSE, 0, 'Already reverted'::TEXT; RETURN; END IF;
    IF v_snapshot.expires_at < NOW() THEN RETURN QUERY SELECT FALSE, 0, 'Snapshot expired'::TEXT; RETURN; END IF;

    FOR v_bookmark_state IN SELECT * FROM jsonb_array_elements(v_snapshot.before_state) LOOP
        UPDATE public.bookmarks SET folder_id = (v_bookmark_state->>'folder_id')::BIGINT, tags = ARRAY(SELECT jsonb_array_elements_text(v_bookmark_state->'tags')), updated_at = NOW()
        WHERE id = (v_bookmark_state->>'id')::BIGINT AND user_id = p_user_id;
        IF FOUND THEN v_restored := v_restored + 1; END IF;
    END LOOP;

    UPDATE public.ai_operation_snapshots SET is_reverted = TRUE, reverted_at = NOW() WHERE id = p_snapshot_id;
    RETURN QUERY SELECT TRUE, v_restored, format('Restored %s bookmarks', v_restored)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old functions first to avoid return type conflict
DROP FUNCTION IF EXISTS get_ai_feedback_stats(UUID);
DROP FUNCTION IF EXISTS get_negative_feedback_reasons(INT);

CREATE OR REPLACE FUNCTION get_ai_feedback_stats(p_user_id UUID)
RETURNS TABLE (total_count INT, positive_count INT, negative_count INT, satisfaction_rate NUMERIC(5,2)) AS $$
BEGIN
    RETURN QUERY
    SELECT COUNT(*)::INT, COUNT(*) FILTER (WHERE type = 'positive')::INT, COUNT(*) FILTER (WHERE type = 'negative')::INT,
    CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE type = 'positive')::NUMERIC / COUNT(*) * 100, 2) ELSE 0 END
    FROM public.ai_feedback WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_negative_feedback_reasons(p_limit INT DEFAULT 100)
RETURNS TABLE (reason TEXT, count INT, percentage NUMERIC(5,2)) AS $$
DECLARE v_total INT;
BEGIN
    SELECT COUNT(*) INTO v_total FROM public.ai_feedback WHERE type = 'negative' AND negative_reason IS NOT NULL;
    IF v_total = 0 THEN RETURN; END IF;
    RETURN QUERY SELECT af.negative_reason, COUNT(*)::INT, ROUND(COUNT(*)::NUMERIC / v_total * 100, 2)
    FROM public.ai_feedback af WHERE af.type = 'negative' AND af.negative_reason IS NOT NULL
    GROUP BY af.negative_reason ORDER BY COUNT(*) DESC LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION update_ai_note_timestamp() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ai_note_timestamp ON public.ai_notes;
CREATE TRIGGER trigger_update_ai_note_timestamp BEFORE UPDATE ON public.ai_notes FOR EACH ROW EXECUTE FUNCTION update_ai_note_timestamp();

CREATE OR REPLACE FUNCTION cleanup_expired_ai_snapshots() RETURNS INT AS $$
DECLARE v_deleted INT;
BEGIN
    DELETE FROM public.ai_operation_snapshots WHERE expires_at < NOW() AND is_reverted = FALSE;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

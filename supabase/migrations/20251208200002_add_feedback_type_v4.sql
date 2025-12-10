-- ================================================
-- V4.0 反馈类型扩展迁移
-- 添加 reject 和 confirm 反馈类型
--
-- 注意：此迁移假设 classification_feedback 表已存在
-- 如果表不存在，请先执行 20251205000002_add_classification_feedback.sql
-- ================================================

-- 仅当表存在时执行所有操作
DO $$
BEGIN
    -- 检查表是否存在
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'classification_feedback'
    ) THEN
        -- 1. 删除旧的约束（如果存在）
        BEGIN
            ALTER TABLE public.classification_feedback
                DROP CONSTRAINT IF EXISTS classification_feedback_feedback_type_check;
        EXCEPTION
            WHEN undefined_object THEN NULL;
        END;

        -- 2. 添加新的约束，包含 V4.0 新增类型
        ALTER TABLE public.classification_feedback
            ADD CONSTRAINT classification_feedback_feedback_type_check
            CHECK (feedback_type IN (
                'wrong_folder',
                'better_folder',
                'folder_not_exist',
                'confidence_too_high',
                'confidence_too_low',
                'helpful',
                'reject',
                'confirm',
                'other'
            ));

        -- 3. 添加 V4.0 扩展字段
        -- bookmark_url 字段
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'classification_feedback'
            AND column_name = 'bookmark_url'
        ) THEN
            ALTER TABLE public.classification_feedback
                ADD COLUMN bookmark_url TEXT;
        END IF;

        -- reject_reason 字段
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'classification_feedback'
            AND column_name = 'reject_reason'
        ) THEN
            ALTER TABLE public.classification_feedback
                ADD COLUMN reject_reason VARCHAR(50);

            -- 添加约束
            ALTER TABLE public.classification_feedback
                ADD CONSTRAINT classification_feedback_reject_reason_check
                CHECK (reject_reason IS NULL OR reject_reason IN (
                    'wrong_category',
                    'irrelevant',
                    'low_confidence',
                    'prefer_inbox',
                    'other'
                ));
        END IF;

        -- trace_id 字段
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'classification_feedback'
            AND column_name = 'trace_id'
        ) THEN
            ALTER TABLE public.classification_feedback
                ADD COLUMN trace_id VARCHAR(100);
        END IF;

        -- original_confidence 字段
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'classification_feedback'
            AND column_name = 'original_confidence'
        ) THEN
            ALTER TABLE public.classification_feedback
                ADD COLUMN original_confidence DECIMAL(5,2);
        END IF;

        -- folder_id 字段（用于文件夹画像统计）
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'classification_feedback'
            AND column_name = 'folder_id'
        ) THEN
            ALTER TABLE public.classification_feedback
                ADD COLUMN folder_id BIGINT REFERENCES public.folders(id) ON DELETE SET NULL;
        END IF;

        RAISE NOTICE 'V4.0 feedback type migration completed successfully';
    ELSE
        RAISE NOTICE 'Table classification_feedback does not exist, skipping migration';
    END IF;
END $$;

-- 4. 添加索引和注释（仅当表存在时）
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'classification_feedback'
    ) THEN
        -- 创建索引
        CREATE INDEX IF NOT EXISTS idx_classification_feedback_trace
            ON public.classification_feedback(trace_id)
            WHERE trace_id IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_classification_feedback_reject_reason
            ON public.classification_feedback(reject_reason)
            WHERE reject_reason IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_classification_feedback_folder
            ON public.classification_feedback(folder_id)
            WHERE folder_id IS NOT NULL;

        -- 添加注释
        COMMENT ON COLUMN public.classification_feedback.reject_reason IS 'V4.0: 拒绝原因分类';
        COMMENT ON COLUMN public.classification_feedback.trace_id IS 'V4.0: 关联的分类追踪 ID';
        COMMENT ON COLUMN public.classification_feedback.bookmark_url IS 'V4.0: 书签 URL（用于纠错缓存）';
        COMMENT ON COLUMN public.classification_feedback.original_confidence IS 'V4.0: 原始分类置信度';
    END IF;
END $$;

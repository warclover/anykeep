-- =============================================================================
-- Migration: Add Bookmark Snapshots Table
-- Description: 网页快照存储表，支持三层快照架构
-- Version: V4.2.1
-- Date: 2025-12-12
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 创建 bookmark_snapshots 表
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookmark_snapshots (
    id BIGSERIAL PRIMARY KEY,
    bookmark_id BIGINT NOT NULL REFERENCES public.bookmarks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 快照类型 (与 job_queue type 对应)
    snapshot_type VARCHAR(20) NOT NULL DEFAULT 'basic'
        CHECK (snapshot_type IN ('basic', 'standard', 'full')),

    -- 状态管理 (与 job_queue status 保持语义一致)
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    error_message TEXT,
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,

    -- 存储信息 (Supabase Storage)
    storage_bucket VARCHAR(50) DEFAULT 'snapshots',
    storage_path TEXT,                  -- 相对路径: {user_id}/{bookmark_id}/{timestamp}
    file_size BIGINT,                   -- 文件大小 (bytes)
    content_hash VARCHAR(64),           -- SHA256 哈希 (用于去重)

    -- Layer 1: 基础快照内容 (Readability 提取，直接存储)
    readable_title VARCHAR(500),
    readable_content TEXT,              -- HTML 格式正文
    readable_text_content TEXT,         -- 纯文本正文 (用于搜索)
    readable_excerpt TEXT,              -- 摘要片段 (300字以内)
    readable_byline VARCHAR(200),       -- 作者信息
    readable_word_count INT,            -- 字数统计

    -- Layer 2+: 高级快照 (存储在 Storage)
    html_storage_path TEXT,             -- 完整 HTML 路径
    screenshot_storage_path TEXT,       -- 截图路径
    screenshot_width INT,
    screenshot_height INT,
    mhtml_storage_path TEXT,            -- MHTML 存档路径

    -- 元数据
    original_url TEXT NOT NULL,
    final_url TEXT,                     -- 最终 URL (处理重定向后)
    captured_at TIMESTAMPTZ,            -- 快照捕获时间

    -- 时间管理
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,             -- 过期时间 (免费用户 30 天)

    -- 关联任务
    job_id UUID REFERENCES job_queue(id) ON DELETE SET NULL
);

-- -----------------------------------------------------------------------------
-- 2. 索引优化
-- -----------------------------------------------------------------------------

-- 用户查询索引
CREATE INDEX idx_snapshots_user_id ON public.bookmark_snapshots(user_id);

-- 书签关联索引 (唯一约束：一个书签只有一个有效快照)
CREATE UNIQUE INDEX idx_snapshots_bookmark_unique
    ON public.bookmark_snapshots(bookmark_id)
    WHERE status NOT IN ('failed', 'expired');

-- 状态查询索引
CREATE INDEX idx_snapshots_status ON public.bookmark_snapshots(status);

-- 去重查询索引
CREATE INDEX idx_snapshots_content_hash ON public.bookmark_snapshots(content_hash)
    WHERE content_hash IS NOT NULL;

-- 过期清理索引
CREATE INDEX idx_snapshots_expires_at ON public.bookmark_snapshots(expires_at)
    WHERE expires_at IS NOT NULL AND status = 'completed';

-- 全文搜索索引 (用于快照内容搜索)
CREATE INDEX idx_snapshots_text_search ON public.bookmark_snapshots
    USING gin(to_tsvector('simple', COALESCE(readable_title, '') || ' ' || COALESCE(readable_text_content, '')));

-- -----------------------------------------------------------------------------
-- 3. RLS 策略
-- -----------------------------------------------------------------------------

ALTER TABLE public.bookmark_snapshots ENABLE ROW LEVEL SECURITY;

-- 用户查看自己的快照
CREATE POLICY "Users can view own snapshots"
    ON public.bookmark_snapshots
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 用户创建自己的快照 (通过书签关联)
CREATE POLICY "Users can create own snapshots"
    ON public.bookmark_snapshots
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.bookmarks
            WHERE id = bookmark_id AND user_id = auth.uid()
        )
    );

-- 用户更新自己的快照
CREATE POLICY "Users can update own snapshots"
    ON public.bookmark_snapshots
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 用户删除自己的快照
CREATE POLICY "Users can delete own snapshots"
    ON public.bookmark_snapshots
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Service Role 全权限 (用于 Cron/Edge Function)
CREATE POLICY "Service role has full access to snapshots"
    ON public.bookmark_snapshots
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 4. 扩展 bookmarks 表
-- -----------------------------------------------------------------------------

-- 添加快照关联字段
ALTER TABLE public.bookmarks
    ADD COLUMN IF NOT EXISTS has_snapshot BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS snapshot_status VARCHAR(20) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS last_snapshot_at TIMESTAMPTZ;

-- 添加约束检查 (如果不存在)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'bookmarks_snapshot_status_check'
    ) THEN
        ALTER TABLE public.bookmarks
            ADD CONSTRAINT bookmarks_snapshot_status_check
            CHECK (snapshot_status IS NULL OR snapshot_status IN ('pending', 'processing', 'completed', 'failed'));
    END IF;
END $$;

-- 快照状态索引
CREATE INDEX IF NOT EXISTS idx_bookmarks_has_snapshot
    ON public.bookmarks(has_snapshot)
    WHERE has_snapshot = TRUE AND deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- 5. 扩展 job_queue 任务类型
-- -----------------------------------------------------------------------------

-- 移除旧约束
ALTER TABLE job_queue DROP CONSTRAINT IF EXISTS job_queue_type_check;

-- 添加新约束 (包含快照任务类型)
ALTER TABLE job_queue ADD CONSTRAINT job_queue_type_check
    CHECK (type IN (
        -- 现有任务类型
        'process_inbox_cache',
        'check_rename_candidates',
        'check_split_candidates',
        'check_merge_candidates',
        'generate_monthly_report',
        'update_folder_profiles',
        'cleanup_expired_data',
        -- 新增快照任务类型
        'create_snapshot_basic',
        'create_snapshot_standard',
        'create_snapshot_full',
        'retry_failed_snapshot',
        'cleanup_expired_snapshots'
    ));

-- -----------------------------------------------------------------------------
-- 6. 辅助函数
-- -----------------------------------------------------------------------------

-- 计算用户快照存储使用量
CREATE OR REPLACE FUNCTION get_user_snapshot_storage(p_user_id UUID)
RETURNS BIGINT AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(file_size) FROM bookmark_snapshots
         WHERE user_id = p_user_id AND status = 'completed'),
        0
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- 检查用户是否可以创建新快照 (配额检查)
CREATE OR REPLACE FUNCTION can_create_snapshot(
    p_user_id UUID,
    p_estimated_size BIGINT DEFAULT 102400  -- 默认预估 100KB
)
RETURNS BOOLEAN AS $$
DECLARE
    v_membership VARCHAR(20);
    v_current_usage BIGINT;
    v_quota BIGINT;
BEGIN
    -- 获取用户会员类型
    SELECT membership_type INTO v_membership
    FROM profiles WHERE id = p_user_id;

    -- 设置配额 (bytes)
    v_quota := CASE v_membership
        WHEN 'PRO' THEN 524288000    -- 500MB
        ELSE 52428800                -- 50MB (免费用户)
    END;

    -- 获取当前使用量
    v_current_usage := get_user_snapshot_storage(p_user_id);

    RETURN (v_current_usage + p_estimated_size) <= v_quota;
END;
$$ LANGUAGE plpgsql STABLE;

-- 获取用户快照配额详情
CREATE OR REPLACE FUNCTION get_user_snapshot_quota(p_user_id UUID)
RETURNS TABLE (
    used_bytes BIGINT,
    quota_bytes BIGINT,
    used_count INT,
    max_count INT,
    membership VARCHAR(20)
) AS $$
DECLARE
    v_membership VARCHAR(20);
BEGIN
    -- 获取会员类型
    SELECT COALESCE(membership_type, 'FREE') INTO v_membership
    FROM profiles WHERE id = p_user_id;

    RETURN QUERY
    SELECT
        get_user_snapshot_storage(p_user_id) AS used_bytes,
        CASE v_membership
            WHEN 'PRO' THEN 524288000::BIGINT   -- 500MB
            ELSE 52428800::BIGINT               -- 50MB
        END AS quota_bytes,
        (SELECT COUNT(*)::INT FROM bookmark_snapshots
         WHERE user_id = p_user_id AND status = 'completed') AS used_count,
        CASE v_membership
            WHEN 'PRO' THEN 1000
            ELSE 100
        END AS max_count,
        v_membership AS membership;
END;
$$ LANGUAGE plpgsql STABLE;

-- 更新时间戳触发器函数
CREATE OR REPLACE FUNCTION update_snapshot_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器 (如果不存在)
DROP TRIGGER IF EXISTS trigger_update_snapshot_timestamp ON bookmark_snapshots;
CREATE TRIGGER trigger_update_snapshot_timestamp
    BEFORE UPDATE ON bookmark_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION update_snapshot_timestamp();

-- 同步快照状态到 bookmarks 表的触发器
CREATE OR REPLACE FUNCTION sync_snapshot_status_to_bookmark()
RETURNS TRIGGER AS $$
BEGIN
    -- 更新书签的快照状态
    UPDATE bookmarks
    SET
        has_snapshot = (NEW.status = 'completed'),
        snapshot_status = NEW.status,
        last_snapshot_at = CASE
            WHEN NEW.status = 'completed' THEN NEW.captured_at
            ELSE last_snapshot_at
        END
    WHERE id = NEW.bookmark_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_snapshot_status ON bookmark_snapshots;
CREATE TRIGGER trigger_sync_snapshot_status
    AFTER INSERT OR UPDATE OF status ON bookmark_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION sync_snapshot_status_to_bookmark();

-- -----------------------------------------------------------------------------
-- 7. 注释
-- -----------------------------------------------------------------------------

COMMENT ON TABLE public.bookmark_snapshots IS '网页快照存储表 (V4.2.1) - 支持三层快照架构: basic/standard/full';
COMMENT ON COLUMN public.bookmark_snapshots.snapshot_type IS '快照类型: basic-Readability正文, standard-完整HTML, full-含截图';
COMMENT ON COLUMN public.bookmark_snapshots.status IS '快照状态: pending-等待处理, processing-处理中, completed-完成, failed-失败, expired-已过期';
COMMENT ON COLUMN public.bookmark_snapshots.readable_content IS 'Readability 提取的 HTML 格式正文';
COMMENT ON COLUMN public.bookmark_snapshots.readable_text_content IS '纯文本正文，用于全文搜索';
COMMENT ON COLUMN public.bookmark_snapshots.content_hash IS 'SHA256 哈希，用于内容去重';
COMMENT ON COLUMN public.bookmark_snapshots.expires_at IS '过期时间：免费用户30天后过期，Pro用户永久';
COMMENT ON COLUMN public.bookmark_snapshots.job_id IS '关联的任务队列ID，用于状态追踪';
COMMENT ON COLUMN public.bookmark_snapshots.storage_path IS '文件存储路径格式: {user_id}/{bookmark_id}/{timestamp}';
COMMENT ON FUNCTION get_user_snapshot_storage(UUID) IS '计算用户快照存储使用量 (bytes)';
COMMENT ON FUNCTION can_create_snapshot(UUID, BIGINT) IS '检查用户是否有足够配额创建新快照';
COMMENT ON FUNCTION get_user_snapshot_quota(UUID) IS '获取用户快照配额详情';

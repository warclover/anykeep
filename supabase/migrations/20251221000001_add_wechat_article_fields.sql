-- =============================================================================
-- Migration: Add WeChat Article Fields
-- Description: 扩展 bookmark_snapshots 表，支持微信公众号文章完整内容存储
-- Version: V4.2.2
-- Date: 2025-12-21
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 扩展 bookmark_snapshots 表
-- -----------------------------------------------------------------------------

-- 正文图片持久化字段
-- 结构: [{ "originalUrl": "mmbiz...", "persistedUrl": "storage...", "alt": "", "status": "success|fallback|failed" }]
ALTER TABLE bookmark_snapshots ADD COLUMN IF NOT EXISTS
  article_images JSONB DEFAULT '[]';

COMMENT ON COLUMN bookmark_snapshots.article_images IS '微信文章正文图片持久化映射 (JSONB 数组)';

-- Markdown 格式正文（增强展示）
ALTER TABLE bookmark_snapshots ADD COLUMN IF NOT EXISTS
  content_markdown TEXT;

COMMENT ON COLUMN bookmark_snapshots.content_markdown IS 'Markdown 格式正文（用于阅读模式）';

-- 内容版本（支持重新获取）
ALTER TABLE bookmark_snapshots ADD COLUMN IF NOT EXISTS
  content_version INTEGER DEFAULT 1;

COMMENT ON COLUMN bookmark_snapshots.content_version IS '内容版本号，重新获取时递增';

-- 图片抓取状态
ALTER TABLE bookmark_snapshots ADD COLUMN IF NOT EXISTS
  images_status VARCHAR(20) DEFAULT 'pending';

-- 添加状态约束（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'bookmark_snapshots_images_status_check'
    ) THEN
        ALTER TABLE bookmark_snapshots
            ADD CONSTRAINT bookmark_snapshots_images_status_check
            CHECK (images_status IN ('pending', 'processing', 'completed', 'partial', 'failed'));
    END IF;
END $$;

COMMENT ON COLUMN bookmark_snapshots.images_status IS '图片持久化状态: pending-待处理, processing-处理中, completed-完成, partial-部分成功, failed-失败';

-- 图片抓取统计
ALTER TABLE bookmark_snapshots ADD COLUMN IF NOT EXISTS
  images_stats JSONB DEFAULT '{"total": 0, "success": 0, "failed": 0}';

COMMENT ON COLUMN bookmark_snapshots.images_stats IS '图片持久化统计: {total, success, failed}';

-- -----------------------------------------------------------------------------
-- 2. 索引优化
-- -----------------------------------------------------------------------------

-- 图片状态索引（用于查询未完成的图片处理任务）
CREATE INDEX IF NOT EXISTS idx_snapshots_images_status
  ON bookmark_snapshots(images_status)
  WHERE images_status NOT IN ('completed', 'pending');

-- 内容版本索引（用于重新获取检测）
CREATE INDEX IF NOT EXISTS idx_snapshots_content_version
  ON bookmark_snapshots(bookmark_id, content_version DESC);

-- -----------------------------------------------------------------------------
-- 3. 辅助函数
-- -----------------------------------------------------------------------------

-- 获取微信文章统计
CREATE OR REPLACE FUNCTION get_wechat_article_stats(p_user_id UUID)
RETURNS TABLE (
    total_articles BIGINT,
    total_images BIGINT,
    success_images BIGINT,
    failed_images BIGINT,
    storage_used BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_articles,
        COALESCE(SUM((images_stats->>'total')::INT), 0)::BIGINT AS total_images,
        COALESCE(SUM((images_stats->>'success')::INT), 0)::BIGINT AS success_images,
        COALESCE(SUM((images_stats->>'failed')::INT), 0)::BIGINT AS failed_images,
        COALESCE(SUM(file_size), 0)::BIGINT AS storage_used
    FROM bookmark_snapshots bs
    JOIN bookmarks b ON bs.bookmark_id = b.id
    WHERE bs.user_id = p_user_id
      AND b.platform = 'WECHAT_OFFICIAL_ACCOUNT'
      AND bs.status = 'completed';
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_wechat_article_stats(UUID) IS '获取用户微信文章统计信息';

-- 增加版本号的原子操作
CREATE OR REPLACE FUNCTION increment_snapshot_version(p_snapshot_id BIGINT)
RETURNS INTEGER AS $$
DECLARE
    v_new_version INTEGER;
BEGIN
    UPDATE bookmark_snapshots
    SET content_version = COALESCE(content_version, 0) + 1,
        updated_at = NOW()
    WHERE id = p_snapshot_id
    RETURNING content_version INTO v_new_version;

    RETURN v_new_version;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_snapshot_version(BIGINT) IS '原子操作：递增快照内容版本号';

-- -----------------------------------------------------------------------------
-- 4. 注释更新
-- -----------------------------------------------------------------------------

COMMENT ON TABLE public.bookmark_snapshots IS '网页快照存储表 (V4.2.2) - 支持三层快照架构: basic/standard/full，增加微信文章图片持久化支持';

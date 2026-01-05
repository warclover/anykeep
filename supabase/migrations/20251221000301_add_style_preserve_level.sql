-- =============================================================================
-- Migration: Add Style Preserve Level
-- Description: 添加样式保留级别字段，支持 text-only / full-snapshot 两种模式
-- Version: V4.2.3
-- Date: 2025-12-21
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 添加样式保留级别字段
-- -----------------------------------------------------------------------------

-- 样式保留级别: text-only (仅文字样式) / full-snapshot (完整快照样式)
ALTER TABLE bookmark_snapshots ADD COLUMN IF NOT EXISTS
  style_preserve_level VARCHAR(20) DEFAULT 'full-snapshot';

-- 添加约束
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'bookmark_snapshots_style_preserve_level_check'
    ) THEN
        ALTER TABLE bookmark_snapshots
            ADD CONSTRAINT bookmark_snapshots_style_preserve_level_check
            CHECK (style_preserve_level IN ('text-only', 'full-snapshot'));
    END IF;
END $$;

COMMENT ON COLUMN bookmark_snapshots.style_preserve_level IS '样式保留级别: text-only-仅文字效果, full-snapshot-完整快照样式';

-- -----------------------------------------------------------------------------
-- 2. 更新已有数据（默认为 text-only，因为旧数据使用的是仅文字效果）
-- -----------------------------------------------------------------------------

-- 将所有已存在的微信文章快照设置为 text-only（保持兼容）
UPDATE bookmark_snapshots bs
SET style_preserve_level = 'text-only'
FROM bookmarks b
WHERE bs.bookmark_id = b.id
  AND b.platform = 'WECHAT_OFFICIAL_ACCOUNT'
  AND bs.style_preserve_level IS NULL;

-- -----------------------------------------------------------------------------
-- 3. 索引优化
-- -----------------------------------------------------------------------------

-- 样式级别索引（用于查询特定样式的文章）
CREATE INDEX IF NOT EXISTS idx_snapshots_style_preserve_level
  ON bookmark_snapshots(style_preserve_level)
  WHERE style_preserve_level IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. 注释更新
-- -----------------------------------------------------------------------------

COMMENT ON TABLE public.bookmark_snapshots IS '网页快照存储表 (V4.2.3) - 支持三层快照架构: basic/standard/full，增加微信文章图片持久化支持和样式保留级别';

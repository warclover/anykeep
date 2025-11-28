-- ===========================================
-- 添加浏览器书签导入元数据
-- ===========================================
-- 版本: 1.0.0
-- 日期: 2025-11-28
-- 说明: 为书签添加导入来源和批次信息，支持浏览器书签导入追踪

-- -------------------------------------------
-- 1. 添加 import_source 列
-- -------------------------------------------
-- 导入来源，如 'browser_chrome', 'browser_edge', 'api', 'share_sheet'
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS import_source TEXT;

COMMENT ON COLUMN public.bookmarks.import_source IS
    '导入来源标识: browser_chrome, browser_edge, browser_firefox, browser_safari, api, share_sheet, manual 等';

-- -------------------------------------------
-- 2. 添加 import_batch_id 列
-- -------------------------------------------
-- 导入批次 ID，用于追踪同一次导入的书签
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS import_batch_id UUID;

COMMENT ON COLUMN public.bookmarks.import_batch_id IS
    '导入批次 ID，用于追踪同一次导入操作的所有书签';

-- -------------------------------------------
-- 3. 添加索引
-- -------------------------------------------
-- 导入来源索引（用于按来源筛选）
CREATE INDEX IF NOT EXISTS idx_bookmarks_import_source
ON public.bookmarks(import_source)
WHERE import_source IS NOT NULL AND deleted_at IS NULL;

-- 导入批次索引（用于批次操作）
CREATE INDEX IF NOT EXISTS idx_bookmarks_import_batch_id
ON public.bookmarks(import_batch_id)
WHERE import_batch_id IS NOT NULL AND deleted_at IS NULL;

-- -------------------------------------------
-- 完成
-- -------------------------------------------

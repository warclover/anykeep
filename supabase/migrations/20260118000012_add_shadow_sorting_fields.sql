-- ============================================
-- Classification v5.0 - Shadow Sorting 字段
-- 创建日期: 2026-01-18
-- 说明: 为bookmarks表添加影子分拣功能所需字段
-- ============================================

-- ============================================
-- 添加 Shadow Sorting 字段到 bookmarks 表
-- ============================================

-- 影子文件夹ID（建议的分类目标）
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS shadow_folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL;

-- 影子文件夹名称（冗余字段,便于查询）
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS shadow_folder_name TEXT;

-- 影子分类置信度（0-1之间）
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS shadow_confidence DECIMAL(3,2);

-- 影子建议时间
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS shadow_suggested_at TIMESTAMPTZ;

-- ============================================
-- 添加字段注释
-- ============================================

COMMENT ON COLUMN bookmarks.shadow_folder_id IS 'Shadow Sorting: 建议的目标文件夹ID';
COMMENT ON COLUMN bookmarks.shadow_folder_name IS 'Shadow Sorting: 建议的目标文件夹名称';
COMMENT ON COLUMN bookmarks.shadow_confidence IS 'Shadow Sorting: 分类建议的置信度(0-1)';
COMMENT ON COLUMN bookmarks.shadow_suggested_at IS 'Shadow Sorting: 建议生成时间';

-- ============================================
-- 添加索引
-- ============================================

-- 查询待处理的影子分拣书签
CREATE INDEX IF NOT EXISTS idx_bookmarks_shadow_pending
ON bookmarks(user_id, shadow_suggested_at DESC)
WHERE shadow_folder_id IS NOT NULL AND folder_id != shadow_folder_id;

-- 查询特定文件夹的影子建议
CREATE INDEX IF NOT EXISTS idx_bookmarks_shadow_folder
ON bookmarks(shadow_folder_id)
WHERE shadow_folder_id IS NOT NULL;

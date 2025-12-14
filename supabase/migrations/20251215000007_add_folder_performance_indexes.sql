-- ============================================================================
-- Migration: 添加文件夹性能索引
-- Version: 20251215000007
-- Description: 优化文件夹事务函数的查询性能
-- ============================================================================

-- 1. 活跃文件夹部分索引（user_id + deleted_at IS NULL）
-- 用于：merge/delete 函数中的验证查询、文件夹列表查询
CREATE INDEX IF NOT EXISTS idx_folders_user_active
ON public.folders(user_id)
WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_folders_user_active IS 'P1-1: 优化活跃文件夹查询（user_id + soft delete filter）';

-- 2. 用户+软删除复合索引（包含常用字段）
-- 用于：文件夹详情查询、权限验证
CREATE INDEX IF NOT EXISTS idx_folders_user_deleted_lookup
ON public.folders(user_id, deleted_at)
INCLUDE (id, name, is_system, folder_group);

COMMENT ON INDEX idx_folders_user_deleted_lookup IS 'P1-1: 优化文件夹详情和权限验证查询';

-- 3. 书签文件夹归属索引（用于 merge/delete 中的书签操作）
-- 部分索引：仅索引未删除的书签
CREATE INDEX IF NOT EXISTS idx_bookmarks_folder_active
ON public.bookmarks(folder_id, user_id)
WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_bookmarks_folder_active IS 'P1-1: 优化文件夹下书签查询（merge/delete 操作）';

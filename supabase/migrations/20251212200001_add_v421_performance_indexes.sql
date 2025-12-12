-- ===========================================
-- V4.2.1: 性能优化索引
-- ===========================================
-- 版本: 4.2.1
-- 日期: 2025-12-12
-- 说明: 针对收藏夹页面性能问题添加优化索引

-- -------------------------------------------
-- 1. folder_profiles 批量查询优化索引
-- -------------------------------------------

-- 优化场景：批量锁状态查询 /api/folders/batch-lock-status
-- 查询模式：SELECT ... FROM folder_profiles WHERE user_id = ? AND folder_id IN (?, ?, ...)
CREATE INDEX IF NOT EXISTS idx_folder_profiles_user_folder
ON public.folder_profiles(user_id, folder_id);

COMMENT ON INDEX idx_folder_profiles_user_folder IS 'V4.2.1: 优化批量文件夹锁状态查询';

-- -------------------------------------------
-- 2. folder_profiles 锁定状态索引
-- -------------------------------------------

-- 优化场景：查询用户已锁定的文件夹
-- 查询模式：SELECT ... FROM folder_profiles WHERE user_id = ? AND is_system_locked = TRUE
CREATE INDEX IF NOT EXISTS idx_folder_profiles_locked
ON public.folder_profiles(user_id)
WHERE is_system_locked = TRUE;

COMMENT ON INDEX idx_folder_profiles_locked IS 'V4.2.1: 优化查询已锁定文件夹';

-- -------------------------------------------
-- 3. folders 树形查询优化索引
-- -------------------------------------------

-- 优化场景：获取用户文件夹列表（按排序顺序）
-- 查询模式：SELECT ... FROM folders WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order, created_at
-- 注意：这是一个覆盖索引，包含排序字段
CREATE INDEX IF NOT EXISTS idx_folders_user_sorted
ON public.folders(user_id, sort_order, created_at)
WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_folders_user_sorted IS 'V4.2.1: 优化文件夹列表排序查询';

-- -------------------------------------------
-- 4. bookmarks 分页查询优化索引
-- -------------------------------------------

-- 优化场景：首页书签分页（游标分页）
-- 查询模式：SELECT ... FROM bookmarks WHERE user_id = ? AND deleted_at IS NULL AND created_at < ? ORDER BY created_at DESC LIMIT ?
-- 注意：已有 idx_bookmarks_user_active_created 但不包含 id，这里添加带 id 的版本用于游标分页
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_cursor_page
ON public.bookmarks(user_id, created_at DESC, id DESC)
WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_bookmarks_user_cursor_page IS 'V4.2.1: 优化游标分页查询';

-- -------------------------------------------
-- 5. bookmarks 文件夹 + 排序复合索引
-- -------------------------------------------

-- 优化场景：文件夹内书签列表（带排序）
-- 查询模式：SELECT ... FROM bookmarks WHERE folder_id = ? AND deleted_at IS NULL ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_bookmarks_folder_sorted
ON public.bookmarks(folder_id, created_at DESC)
WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_bookmarks_folder_sorted IS 'V4.2.1: 优化文件夹内书签排序查询';

-- -------------------------------------------
-- 6. 分析并更新统计信息
-- -------------------------------------------

-- 更新表统计信息以确保查询优化器使用新索引
ANALYZE public.folder_profiles;
ANALYZE public.folders;
ANALYZE public.bookmarks;

-- ===========================================
-- 完成
-- ===========================================

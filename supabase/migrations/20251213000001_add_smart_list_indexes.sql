-- ===========================================
-- V10.0: 智能列表筛选优化索引
-- ===========================================
-- 版本: 10.0.0
-- 日期: 2025-12-13
-- 说明: 为智能列表功能添加组合查询索引，优化多条件筛选性能

-- -------------------------------------------
-- 1. 待阅读场景优化索引
-- -------------------------------------------

-- 优化场景：智能列表"待阅读"筛选（未读 + 按时间排序）
-- 查询模式：SELECT ... WHERE user_id = ? AND is_read = FALSE AND deleted_at IS NULL ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_bookmarks_unread_sorted
ON public.bookmarks(user_id, created_at DESC)
WHERE is_read = FALSE AND deleted_at IS NULL AND is_in_trash = FALSE;

COMMENT ON INDEX idx_bookmarks_unread_sorted IS 'V10.0: 优化待阅读智能列表查询';

-- -------------------------------------------
-- 2. 高价值收藏优化索引
-- -------------------------------------------

-- 优化场景：智能列表"高价值收藏"筛选（5星评级 + 按时间排序）
-- 查询模式：SELECT ... WHERE user_id = ? AND rating = 5 AND deleted_at IS NULL ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_bookmarks_high_value_sorted
ON public.bookmarks(user_id, created_at DESC)
WHERE rating = 5 AND deleted_at IS NULL AND is_in_trash = FALSE;

COMMENT ON INDEX idx_bookmarks_high_value_sorted IS 'V10.0: 优化高价值收藏智能列表查询';

-- -------------------------------------------
-- 3. 星标收藏场景优化索引
-- -------------------------------------------

-- 优化场景：智能列表"星标收藏"（星标 + 按时间排序）
-- 注意：现有 idx_bookmarks_starred 已覆盖 is_starred=TRUE 场景
-- 这里为通用星标查询提供覆盖索引
CREATE INDEX IF NOT EXISTS idx_bookmarks_starred_sorted
ON public.bookmarks(user_id, is_starred, created_at DESC)
WHERE deleted_at IS NULL AND is_in_trash = FALSE;

COMMENT ON INDEX idx_bookmarks_starred_sorted IS 'V10.0: 优化星标筛选智能列表查询';

-- -------------------------------------------
-- 4. 时间范围组合筛选索引
-- -------------------------------------------

-- 优化场景：智能列表按时间范围筛选（最近一周、最近一月等）
-- 查询模式：SELECT ... WHERE user_id = ? AND created_at >= ? AND created_at <= ? ORDER BY created_at DESC
-- 注意：现有 idx_bookmarks_user_active_created 和 idx_bookmarks_user_cursor_page 已覆盖此场景
-- 此处为更精确的部分索引，进一步优化近期数据查询

-- 近30天数据索引（覆盖"最近一周"和"最近一月"场景）
-- 注意：PostgreSQL 不支持动态日期的部分索引，这里使用通用索引策略
-- 现有索引已足够，不添加额外索引

-- -------------------------------------------
-- 5. 评级范围筛选索引
-- -------------------------------------------

-- 优化场景：按评级范围筛选（如4-5星的优质内容）
-- 查询模式：SELECT ... WHERE user_id = ? AND rating >= ? AND rating <= ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_bookmarks_rating_sorted
ON public.bookmarks(user_id, rating, created_at DESC)
WHERE deleted_at IS NULL AND is_in_trash = FALSE AND rating > 0;

COMMENT ON INDEX idx_bookmarks_rating_sorted IS 'V10.0: 优化评级范围筛选查询';

-- -------------------------------------------
-- 6. 用途标签组合筛选（已有 GIN 索引覆盖）
-- -------------------------------------------

-- 现有 idx_bookmarks_user_tags (GIN) 已覆盖用途标签筛选
-- 无需额外索引

-- -------------------------------------------
-- 7. 更新表统计信息
-- -------------------------------------------

ANALYZE public.bookmarks;

-- ===========================================
-- 完成
-- ===========================================

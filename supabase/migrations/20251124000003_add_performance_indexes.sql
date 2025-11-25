-- ===========================================
-- 性能优化索引
-- ===========================================
-- 版本: 1.0.0
-- 日期: 2025-11-24
-- 说明: 优化收藏查询、筛选、搜索等核心功能的性能

-- -------------------------------------------
-- 1. 收藏表核心查询索引
-- -------------------------------------------

-- 用户收藏列表查询（按创建时间倒序）
-- 优化场景：首页收藏列表、文件夹内收藏列表
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_active_created
ON bookmarks (user_id, created_at DESC)
WHERE deleted_at IS NULL;

-- 平台筛选查询
-- 优化场景：按平台筛选收藏（微信、B站、小红书等）
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_platform
ON bookmarks (user_id, platform)
WHERE deleted_at IS NULL;

-- 文件夹筛选查询
-- 优化场景：查看特定文件夹下的收藏
CREATE INDEX IF NOT EXISTS idx_bookmarks_folder
ON bookmarks (folder_id)
WHERE deleted_at IS NULL;

-- -------------------------------------------
-- 2. 全文搜索索引（GIN 索引）
-- -------------------------------------------

-- 标题全文搜索（使用三元组）
-- 优化场景：标题模糊搜索 (ILIKE '%keyword%')
CREATE INDEX IF NOT EXISTS idx_bookmarks_title_trgm
ON bookmarks USING GIN (title extensions.gin_trgm_ops);

-- 描述全文搜索（使用三元组）
-- 优化场景：描述模糊搜索 (ILIKE '%keyword%')
CREATE INDEX IF NOT EXISTS idx_bookmarks_description_trgm
ON bookmarks USING GIN (description extensions.gin_trgm_ops);

-- -------------------------------------------
-- 3. 用户标签索引（GIN 索引）
-- -------------------------------------------

-- 用户标签数组索引
-- 优化场景：按标签筛选收藏
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_tags
ON bookmarks USING GIN (user_tags);

-- AI 标签数组索引
-- 优化场景：按 AI 生成的标签筛选收藏
CREATE INDEX IF NOT EXISTS idx_bookmarks_ai_tags
ON bookmarks USING GIN (ai_tags);

-- -------------------------------------------
-- 4. 复合索引（优化特定查询组合）
-- -------------------------------------------

-- 用户 + 平台 + 创建时间
-- 优化场景：查看某用户在某平台的最新收藏
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_platform_created
ON bookmarks (user_id, platform, created_at DESC)
WHERE deleted_at IS NULL;

-- 用户 + 文件夹 + 创建时间
-- 优化场景：查看某用户特定文件夹的最新收藏
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_folder_created
ON bookmarks (user_id, folder_id, created_at DESC)
WHERE deleted_at IS NULL;

-- -------------------------------------------
-- 5. 统计分析索引
-- -------------------------------------------

-- 按平台统计
-- 优化场景：统计页面的平台分布图表
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_platform_count
ON bookmarks (user_id, platform)
WHERE deleted_at IS NULL;

-- 按日期统计（已移除 - DATE()函数不是IMMUTABLE，可以直接使用created_at查询）
-- 优化场景：统计页面的时间趋势图表可以使用 created_at 字段直接查询
-- CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created_date
-- ON bookmarks (user_id, DATE(created_at))
-- WHERE deleted_at IS NULL;

-- -------------------------------------------
-- 注释和说明
-- -------------------------------------------

COMMENT ON INDEX idx_bookmarks_user_active_created IS '优化用户收藏列表查询（按创建时间倒序）';
COMMENT ON INDEX idx_bookmarks_user_platform IS '优化平台筛选查询';
COMMENT ON INDEX idx_bookmarks_folder IS '优化文件夹收藏查询';
COMMENT ON INDEX idx_bookmarks_title_trgm IS '优化标题全文搜索（三元组索引）';
COMMENT ON INDEX idx_bookmarks_description_trgm IS '优化描述全文搜索（三元组索引）';
COMMENT ON INDEX idx_bookmarks_user_tags IS '优化用户标签筛选';
COMMENT ON INDEX idx_bookmarks_ai_tags IS '优化 AI 标签筛选';
COMMENT ON INDEX idx_bookmarks_user_platform_created IS '优化用户+平台+时间组合查询';
COMMENT ON INDEX idx_bookmarks_user_folder_created IS '优化用户+文件夹+时间组合查询';
COMMENT ON INDEX idx_bookmarks_user_platform_count IS '优化平台统计查询';
-- COMMENT ON INDEX idx_bookmarks_user_created_date IS '优化日期趋势统计'; -- 已移除

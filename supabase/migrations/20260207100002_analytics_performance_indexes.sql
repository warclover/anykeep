-- Analytics 查询性能索引
-- 支持 get_user_analytics() 函数的快速聚合查询

-- 复合索引：用户 + 创建时间 + 平台（用于趋势和平台统计）
CREATE INDEX IF NOT EXISTS idx_bookmarks_analytics_composite
ON bookmarks(user_id, created_at DESC, platform)
WHERE deleted_at IS NULL;

-- 复合索引：用户 + 文件夹（用于文件夹分布统计）
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_folder_analytics
ON bookmarks(user_id, folder_id)
WHERE deleted_at IS NULL;

-- GIN 索引：ai_tags 数组（用于标签统计的 unnest）
-- 注意：ai_tags 是 text[] 类型，使用 array_ops 操作符类
CREATE INDEX IF NOT EXISTS idx_bookmarks_ai_tags_gin
ON bookmarks USING gin(ai_tags)
WHERE deleted_at IS NULL AND ai_tags IS NOT NULL;

-- 添加索引注释
COMMENT ON INDEX idx_bookmarks_analytics_composite IS 'Analytics 聚合查询优化：趋势数据、平台分布、时间对比';
COMMENT ON INDEX idx_bookmarks_user_folder_analytics IS 'Analytics 文件夹分布统计优化';
COMMENT ON INDEX idx_bookmarks_ai_tags_gin IS 'Analytics 标签统计优化：支持数组展开查询';

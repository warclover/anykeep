-- 收藏卡片优化 P2.3：添加星标/Pin置顶功能
-- 新增 is_starred 和 starred_at 字段

-- 添加星标字段
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS starred_at TIMESTAMPTZ;

-- 创建索引优化星标查询
CREATE INDEX IF NOT EXISTS idx_bookmarks_starred
ON bookmarks (user_id, is_starred, starred_at DESC)
WHERE is_starred = TRUE AND deleted_at IS NULL;

-- 添加字段注释
COMMENT ON COLUMN bookmarks.is_starred IS '是否星标/置顶';
COMMENT ON COLUMN bookmarks.starred_at IS '星标时间';

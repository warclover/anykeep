-- 添加已读/未读状态字段
-- P1 功能：阅读状态标记

-- 1. 添加 is_read 列（默认为 false）
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- 2. 添加 read_at 列（记录阅读时间）
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- 3. 为 is_read 添加索引（用于筛选未读内容）
CREATE INDEX IF NOT EXISTS idx_bookmarks_is_read ON bookmarks(user_id, is_read) WHERE deleted_at IS NULL;

-- 4. 添加注释
COMMENT ON COLUMN bookmarks.is_read IS '是否已读';
COMMENT ON COLUMN bookmarks.read_at IS '阅读时间';

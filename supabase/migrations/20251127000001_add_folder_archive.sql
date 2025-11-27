-- ===========================================
-- 文件夹停用/启用功能
-- 添加 is_archived 字段用于标记停用的文件夹
-- ===========================================

-- 添加 is_archived 字段
ALTER TABLE folders
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- 添加索引以优化查询
CREATE INDEX IF NOT EXISTS idx_folders_is_archived ON folders(is_archived) WHERE deleted_at IS NULL;

-- 更新注释
COMMENT ON COLUMN folders.is_archived IS '是否已停用，停用的文件夹不会在创建收藏时作为选项显示';

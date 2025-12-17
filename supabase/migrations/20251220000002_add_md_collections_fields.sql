-- Migration: 20251220000002_add_md_collections_fields.sql
-- P2-007: 添加 MD 收藏表缺失字段
-- 修复上传和列表 API 500 错误

-- ============================================
-- 1. 添加来源相关字段
-- ============================================

-- 来源类型：upload (文件上传) / paste (粘贴) / api (API 创建)
ALTER TABLE md_collections
ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'paste';

-- 源文件名（仅文件上传时有值）
ALTER TABLE md_collections
ADD COLUMN IF NOT EXISTS source_filename VARCHAR(500);

-- ============================================
-- 2. 添加阅读状态相关字段
-- ============================================

-- 是否已阅读
ALTER TABLE md_collections
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- 是否星标
ALTER TABLE md_collections
ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;

-- 阅读时间戳
ALTER TABLE md_collections
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- 星标时间戳
ALTER TABLE md_collections
ADD COLUMN IF NOT EXISTS starred_at TIMESTAMPTZ;

-- ============================================
-- 3. 添加 AI 处理相关字段
-- ============================================

-- AI 处理完成时间
ALTER TABLE md_collections
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- AI 处理失败的错误信息
ALTER TABLE md_collections
ADD COLUMN IF NOT EXISTS processing_error TEXT;

-- ============================================
-- 4. 添加索引
-- ============================================

-- 来源类型索引
CREATE INDEX IF NOT EXISTS idx_md_collections_source_type
ON md_collections(source_type)
WHERE deleted_at IS NULL;

-- 星标索引
CREATE INDEX IF NOT EXISTS idx_md_collections_starred
ON md_collections(is_starred)
WHERE deleted_at IS NULL AND is_starred = TRUE;

-- ============================================
-- 5. 添加注释
-- ============================================
COMMENT ON COLUMN md_collections.source_type IS '来源类型：upload/paste/api';
COMMENT ON COLUMN md_collections.source_filename IS '源文件名（文件上传时记录）';
COMMENT ON COLUMN md_collections.is_read IS '是否已阅读';
COMMENT ON COLUMN md_collections.is_starred IS '是否星标收藏';
COMMENT ON COLUMN md_collections.read_at IS '标记为已读的时间';
COMMENT ON COLUMN md_collections.starred_at IS '标记为星标的时间';
COMMENT ON COLUMN md_collections.processed_at IS 'AI 处理完成时间';
COMMENT ON COLUMN md_collections.processing_error IS 'AI 处理失败的错误信息';

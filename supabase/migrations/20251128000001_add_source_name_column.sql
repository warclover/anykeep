-- =============================================
-- 添加 source_name 字段（来源/公众号名称）
-- 用于区分「来源名称」和「文章作者」
-- =============================================

-- 1. 添加 source_name 列
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS source_name VARCHAR(200);

-- 2. 添加注释
COMMENT ON COLUMN public.bookmarks.source_name IS '来源名称（公众号名称、UP主频道名等）';
COMMENT ON COLUMN public.bookmarks.author IS '内容作者（文章撰写者、视频创作者等）';

-- 3. 为已有的微信公众号数据，尝试从 author 字段迁移公众号名称到 source_name
-- 注意：这是一个可选的数据迁移，如果 author 看起来像是公众号名称，则复制到 source_name
-- 实际上新的爬虫会正确分离这两个字段，历史数据可以保持原样

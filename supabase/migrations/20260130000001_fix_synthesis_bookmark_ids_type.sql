-- 修复 synthesis_reports 表的 source_bookmark_ids 字段类型
-- 从 UUID[] 改为 BIGINT[]，以匹配 bookmarks.id 类型
--
-- @version 1.0.0
-- @since 2026-01-30

-- 1. 删除旧列并添加新列（正确类型）
ALTER TABLE synthesis_reports
  DROP COLUMN IF EXISTS source_bookmark_ids;

ALTER TABLE synthesis_reports
  ADD COLUMN source_bookmark_ids BIGINT[];

-- 2. 添加注释
COMMENT ON COLUMN synthesis_reports.source_bookmark_ids IS '手动选择的书签 ID 列表 (BIGINT 匹配 bookmarks.id)';

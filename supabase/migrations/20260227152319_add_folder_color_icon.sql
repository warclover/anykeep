-- ============================================
-- 添加 folders 表的 color 和 icon 字段
-- ============================================
-- 版本: 1.0.0
-- 日期: 2026-02-27
-- 说明: 修复创建文件夹时颜色选择不生效的问题
--       这些字段在前端和验证 schema 中已存在，但数据库表缺少

-- -------------------------------------------
-- 1. 添加 color ��� icon 字段
-- -------------------------------------------

-- 文件夹颜色（十六进制格式，如 #3B82F6）
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS
  color VARCHAR(7) CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$');

-- 文件夹图标（emoji 或图标名称）
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS
  icon VARCHAR(50);

-- -------------------------------------------
-- 2. 添加注释
-- -------------------------------------------

COMMENT ON COLUMN public.folders.color IS
  '文件夹颜色，十六进制格式（如 #3B82F6）';

COMMENT ON COLUMN public.folders.icon IS
  '文件夹图标，emoji 或图标名称';

-- -------------------------------------------
-- 完成
-- -------------------------------------------

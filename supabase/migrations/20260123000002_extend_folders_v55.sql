-- ===========================================
-- AnyKeep v5.5 晶体生长系统 - folders 表扩展
-- ===========================================
-- 版本: 5.5.0
-- 日期: 2026-01-23
-- 说明: 扩展 folders 表，添加 AI 生成标记和晶体元数据

-- -------------------------------------------
-- 1. AI 生成标记字段
-- -------------------------------------------

-- 是否由 AI 自动创建
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS
  is_ai_generated BOOLEAN DEFAULT FALSE;

-- AI 创建来源
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS
  ai_generation_source TEXT CHECK (
    ai_generation_source IS NULL OR
    ai_generation_source IN ('CRYSTAL_GROWTH', 'SMART_SORTING', 'SUGGESTION', 'MERGE', 'SPLIT')
  );

-- -------------------------------------------
-- 2. 晶体元数据字段
-- -------------------------------------------

-- 晶体诞生时间（首次由 AI 创建的时间）
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS
  crystal_birth_time TIMESTAMPTZ;

-- 原始晶核书签 ID���触发创建的书签集合）
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS
  origin_bookmark_ids BIGINT[];

-- 临时名称标记（异步命名优化用）
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS
  is_naming_pending BOOLEAN DEFAULT FALSE;

-- -------------------------------------------
-- 3. 索引
-- -------------------------------------------

-- AI 生成文件夹查询索引
CREATE INDEX IF NOT EXISTS idx_folders_ai_generated
  ON public.folders (user_id, is_ai_generated)
  WHERE is_ai_generated = TRUE AND deleted_at IS NULL;

-- 待命名文件夹查询索引
CREATE INDEX IF NOT EXISTS idx_folders_naming_pending
  ON public.folders (user_id)
  WHERE is_naming_pending = TRUE AND deleted_at IS NULL;

-- AI 来源索引（用于统计分析）
CREATE INDEX IF NOT EXISTS idx_folders_ai_source
  ON public.folders (user_id, ai_generation_source)
  WHERE ai_generation_source IS NOT NULL AND deleted_at IS NULL;

-- -------------------------------------------
-- 4. 注释
-- -------------------------------------------

COMMENT ON COLUMN public.folders.is_ai_generated IS
  '是否由 AI 自动创建的文件夹';

COMMENT ON COLUMN public.folders.ai_generation_source IS
  'AI 创建来源: CRYSTAL_GROWTH-晶体生长, SMART_SORTING-智能排序, SUGGESTION-建议采纳, MERGE-合并, SPLIT-分裂';

COMMENT ON COLUMN public.folders.crystal_birth_time IS
  '晶体诞生时间，仅对 AI 创建的文件夹有效';

COMMENT ON COLUMN public.folders.origin_bookmark_ids IS
  '触发创建的原始晶核书签 ID 数组';

COMMENT ON COLUMN public.folders.is_naming_pending IS
  '是否正在等待异步命名优化';

-- -------------------------------------------
-- 完成
-- -------------------------------------------

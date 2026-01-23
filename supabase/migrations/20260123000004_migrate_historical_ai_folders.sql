-- ===========================================
-- AnyKeep v5.5 晶体生长系统 - 历史 AI 文件夹迁移
-- ===========================================
-- 版本: 5.5.0
-- 日期: 2026-01-23
-- 说明: 基于创建时间推断标记历史 AI 文件夹

-- -------------------------------------------
-- 1. 标记 SmartSorting 自动创建的文件夹
-- -------------------------------------------
-- 规则：凌晨 4-5 点创建的非系统文件夹
-- 这是 SmartSorting 定时任务的典型执行时间段

UPDATE public.folders
SET
  is_ai_generated = TRUE,
  ai_generation_source = 'SMART_SORTING'
WHERE
  deleted_at IS NULL
  AND is_ai_generated IS NOT TRUE  -- 未标记的
  AND EXTRACT(HOUR FROM created_at) BETWEEN 4 AND 5
  AND created_at > NOW() - INTERVAL '90 days';

-- -------------------------------------------
-- 2. 记录迁移结果
-- -------------------------------------------

DO $$
DECLARE
  migrated_count INT;
BEGIN
  SELECT COUNT(*) INTO migrated_count
  FROM public.folders
  WHERE ai_generation_source = 'SMART_SORTING'
    AND deleted_at IS NULL;

  RAISE NOTICE 'V5.5 Migration: Marked % folders as AI-generated (SMART_SORTING)', migrated_count;
END $$;

-- -------------------------------------------
-- 完成
-- -------------------------------------------

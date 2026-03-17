-- =============================================================================
-- Migration: Extend snapshot trigger_source constraint
-- Description: 新增 'auto-save' 来源，用于收藏时自动保存内容快照
-- Date: 2026-03-17
-- =============================================================================

-- 移除旧约束
ALTER TABLE bookmark_snapshots
  DROP CONSTRAINT IF EXISTS bookmark_snapshots_trigger_source_check;

-- 添加扩展后的约束
ALTER TABLE bookmark_snapshots
  ADD CONSTRAINT bookmark_snapshots_trigger_source_check
  CHECK (trigger_source IN ('manual', 'auto-tag', 'batch', 'scheduled', 'api', 'auto-save'));

COMMENT ON COLUMN bookmark_snapshots.trigger_source IS '快照触发来源: manual=手动, auto-tag=标签自动, batch=批量, scheduled=定时, api=API调用, auto-save=收藏时自动保存';

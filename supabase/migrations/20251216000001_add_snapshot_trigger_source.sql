-- Migration: 20251216000001_add_snapshot_trigger_source.sql
-- P2-010: 用途标签触发自动快照 - 记录快照触发来源
-- 用于后续分析和统计

-- 添加触发来源字段（先添加列，再添加约束）
ALTER TABLE bookmark_snapshots
  ADD COLUMN IF NOT EXISTS trigger_source VARCHAR(50) DEFAULT 'manual';

-- 添加触发标签字段（仅 auto-tag 来源时有值）
ALTER TABLE bookmark_snapshots
  ADD COLUMN IF NOT EXISTS trigger_tag VARCHAR(100);

-- 添加 CHECK 约束（使用命名约束，便于管理）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookmark_snapshots_trigger_source_check'
  ) THEN
    ALTER TABLE bookmark_snapshots
      ADD CONSTRAINT bookmark_snapshots_trigger_source_check
      CHECK (trigger_source IN ('manual', 'auto-tag', 'batch', 'scheduled', 'api'));
  END IF;
END $$;

-- 创建索引用于统计分析
CREATE INDEX IF NOT EXISTS idx_snapshots_trigger_source
  ON bookmark_snapshots(trigger_source)
  WHERE trigger_source IS NOT NULL;

-- 添加字段注释
COMMENT ON COLUMN bookmark_snapshots.trigger_source IS '快照触发来源: manual=手动, auto-tag=标签自动, batch=批量, scheduled=定时, api=API调用';
COMMENT ON COLUMN bookmark_snapshots.trigger_tag IS '触发快照的标签名称（仅 auto-tag 来源时有值）';

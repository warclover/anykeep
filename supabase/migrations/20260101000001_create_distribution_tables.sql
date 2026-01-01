-- Migration: Create distribution tables for Knowledge Distribution Hub
-- Version: 20260101000001
-- Description: 知识分发中心 - 分发目标和分发记录表

-- ============================================================================
-- 1. CREATE TABLES
-- ============================================================================

-- 分发目标表
CREATE TABLE IF NOT EXISTS distribution_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 目标配置
  target_type TEXT NOT NULL CHECK (target_type IN ('obsidian', 'notion', 'webhook', 'rss', 'manual_export')),
  name TEXT NOT NULL,                    -- 用户自定义名称
  enabled BOOLEAN NOT NULL DEFAULT true, -- 是否启用

  -- 触发配置
  trigger_mode TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_mode IN ('realtime', 'scheduled', 'manual')),
  schedule_interval_minutes INTEGER,     -- 定时触发间隔（分钟）

  -- 筛选条件
  filter_platforms TEXT[],               -- 平台筛选
  filter_folders UUID[],                 -- 文件夹 ID 筛选
  filter_tags TEXT[],                    -- 标签筛选
  include_ai_summary BOOLEAN DEFAULT true, -- 是否包含 AI 摘要

  -- 目标特定配置（JSONB）
  target_config JSONB NOT NULL DEFAULT '{}',

  -- 状态
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'syncing', 'error')),
  last_sync_at TIMESTAMPTZ,              -- 最后同步时间
  last_error TEXT,                       -- 最后错误信息
  synced_count INTEGER NOT NULL DEFAULT 0, -- 已同步数量

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 分发记录表
CREATE TABLE IF NOT EXISTS distribution_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES distribution_targets(id) ON DELETE CASCADE,
  bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,

  -- 分发状态
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  distributed_at TIMESTAMPTZ,            -- 分发时间

  -- 外部系统信息
  external_id TEXT,                      -- 外部系统 ID（如 Notion page ID）

  -- 错误处理
  error_message TEXT,                    -- 错误信息
  retry_count INTEGER NOT NULL DEFAULT 0, -- 重试次数

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT now(),

  -- 唯一约束：同一目标不重复分发同一书签
  UNIQUE(target_id, bookmark_id)
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

-- distribution_targets 索引

-- 用户查询索引
CREATE INDEX IF NOT EXISTS idx_distribution_targets_user_id
  ON distribution_targets(user_id);

-- 类型筛选索引
CREATE INDEX IF NOT EXISTS idx_distribution_targets_type
  ON distribution_targets(target_type);

-- 启用状态索引
CREATE INDEX IF NOT EXISTS idx_distribution_targets_enabled
  ON distribution_targets(user_id, enabled) WHERE enabled = true;

-- 触发模式索引（用于定时任务查询）
CREATE INDEX IF NOT EXISTS idx_distribution_targets_trigger_mode
  ON distribution_targets(trigger_mode) WHERE enabled = true;

-- 复合索引：用户 + 类型 (常用查询)
CREATE INDEX IF NOT EXISTS idx_distribution_targets_user_type
  ON distribution_targets(user_id, target_type);

-- distribution_records 索引

-- 目标查询索引
CREATE INDEX IF NOT EXISTS idx_distribution_records_target_id
  ON distribution_records(target_id);

-- 书签查询索引
CREATE INDEX IF NOT EXISTS idx_distribution_records_bookmark_id
  ON distribution_records(bookmark_id);

-- 状态筛选索引
CREATE INDEX IF NOT EXISTS idx_distribution_records_status
  ON distribution_records(status);

-- 待处理记录索引（用于重试查询）
CREATE INDEX IF NOT EXISTS idx_distribution_records_pending
  ON distribution_records(target_id, status) WHERE status = 'pending';

-- 失败记录索引（用于重试查询）
CREATE INDEX IF NOT EXISTS idx_distribution_records_failed
  ON distribution_records(target_id, status, retry_count) WHERE status = 'failed';

-- 时间排序索引
CREATE INDEX IF NOT EXISTS idx_distribution_records_created_at
  ON distribution_records(created_at DESC);

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- distribution_targets RLS

ALTER TABLE distribution_targets ENABLE ROW LEVEL SECURITY;

-- 查看自己的目标
CREATE POLICY "Users can view own distribution targets"
  ON distribution_targets
  FOR SELECT
  USING (auth.uid() = user_id);

-- 创建自己的目标
CREATE POLICY "Users can create own distribution targets"
  ON distribution_targets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 更新自己的目标
CREATE POLICY "Users can update own distribution targets"
  ON distribution_targets
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 删除自己的目标
CREATE POLICY "Users can delete own distribution targets"
  ON distribution_targets
  FOR DELETE
  USING (auth.uid() = user_id);

-- distribution_records RLS

ALTER TABLE distribution_records ENABLE ROW LEVEL SECURITY;

-- 查看自己的分发记录（通过 target 关联）
CREATE POLICY "Users can view own distribution records"
  ON distribution_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM distribution_targets
      WHERE distribution_targets.id = distribution_records.target_id
      AND distribution_targets.user_id = auth.uid()
    )
  );

-- 创建自己的分发记录
CREATE POLICY "Users can create own distribution records"
  ON distribution_records
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM distribution_targets
      WHERE distribution_targets.id = distribution_records.target_id
      AND distribution_targets.user_id = auth.uid()
    )
  );

-- 更新自己的分发记录
CREATE POLICY "Users can update own distribution records"
  ON distribution_records
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM distribution_targets
      WHERE distribution_targets.id = distribution_records.target_id
      AND distribution_targets.user_id = auth.uid()
    )
  );

-- 删除自己的分发记录
CREATE POLICY "Users can delete own distribution records"
  ON distribution_records
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM distribution_targets
      WHERE distribution_targets.id = distribution_records.target_id
      AND distribution_targets.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. TRIGGERS
-- ============================================================================

-- 自动更新 distribution_targets.updated_at 时间戳
CREATE OR REPLACE FUNCTION update_distribution_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_distribution_targets_updated_at
  BEFORE UPDATE ON distribution_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_distribution_targets_updated_at();

-- 分发成功时自动设置 distributed_at
CREATE OR REPLACE FUNCTION set_distribution_record_distributed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'success' AND (OLD.status IS NULL OR OLD.status != 'success') THEN
    NEW.distributed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_distribution_record_distributed_at
  BEFORE INSERT OR UPDATE ON distribution_records
  FOR EACH ROW
  EXECUTE FUNCTION set_distribution_record_distributed_at();

-- 分发成功后更新目标的统计信息
CREATE OR REPLACE FUNCTION update_distribution_target_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'success' AND (OLD IS NULL OR OLD.status != 'success') THEN
    UPDATE distribution_targets
    SET
      synced_count = synced_count + 1,
      last_sync_at = now(),
      status = 'idle'
    WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_distribution_target_stats
  AFTER INSERT OR UPDATE ON distribution_records
  FOR EACH ROW
  EXECUTE FUNCTION update_distribution_target_stats();

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON TABLE distribution_targets IS '知识分发目标表 - 存储分发目标配置（Obsidian, Notion, Webhook, RSS 等）';
COMMENT ON TABLE distribution_records IS '知识分发记录表 - 存储每条书签的分发历史';

COMMENT ON COLUMN distribution_targets.target_type IS '目标类型: obsidian, notion, webhook, rss, manual_export';
COMMENT ON COLUMN distribution_targets.trigger_mode IS '触发模式: realtime(实时), scheduled(定时), manual(手动)';
COMMENT ON COLUMN distribution_targets.target_config IS '目标特定配置，如 Obsidian vault 路径、Notion database ID 等';
COMMENT ON COLUMN distribution_targets.status IS '当前状态: idle(空闲), syncing(同步中), error(错误)';
COMMENT ON COLUMN distribution_targets.synced_count IS '已成功同步的书签数量';

COMMENT ON COLUMN distribution_records.external_id IS '外部系统中的 ID，如 Notion page ID';
COMMENT ON COLUMN distribution_records.retry_count IS '失败后的重试次数';

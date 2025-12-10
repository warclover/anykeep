-- =============================================================================
-- Migration: Add Operation Snapshots for AI Folder Evolution (V4.2)
-- Description: 支持 AI 文件夹操作的撤销功能（2天窗口期）
-- Version: V4.2 Phase 1.1.1
-- =============================================================================

-- 操作快照表：记录 AI 对文件夹的所有操作，支持 2 天内撤销
CREATE TABLE IF NOT EXISTS operation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 操作类型
  action TEXT NOT NULL CHECK (action IN ('create', 'split', 'merge', 'rename', 'move')),

  -- 操作目标（根据 action 类型，可能使用 folder_id 或 folder_ids）
  folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL,        -- 单文件夹操作（create/rename）
  folder_ids BIGINT[],                                               -- 多文件夹操作（split/merge）
  bookmark_ids BIGINT[],                                             -- 涉及的书签 ID

  -- 操作前后状态（用于回滚）
  before_state JSONB NOT NULL DEFAULT '{}',
  after_state JSONB NOT NULL DEFAULT '{}',

  -- 操作说明
  reason TEXT,                                                       -- AI 决策理由

  -- 撤销状态
  is_undone BOOLEAN DEFAULT FALSE,
  undone_at TIMESTAMPTZ,

  -- 时间管理
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '2 days'),

  -- 约束
  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_snapshots_user_created
  ON operation_snapshots(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_snapshots_expires
  ON operation_snapshots(expires_at)
  WHERE NOT is_undone;

CREATE INDEX IF NOT EXISTS idx_snapshots_folder
  ON operation_snapshots(folder_id)
  WHERE folder_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_snapshots_action
  ON operation_snapshots(user_id, action);

-- =============================================================================
-- RLS 策略
-- =============================================================================

ALTER TABLE operation_snapshots ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的操作记录
CREATE POLICY "Users can view own operation snapshots"
  ON operation_snapshots
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 用户只能创建自己的操作记录
CREATE POLICY "Users can create own operation snapshots"
  ON operation_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的操作记录（用于撤销操作）
CREATE POLICY "Users can update own operation snapshots"
  ON operation_snapshots
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 用户不能直接删除操作记录（由系统定时清理）
-- 不创建 DELETE 策略

-- =============================================================================
-- 辅助函数
-- =============================================================================

-- 获取用户未撤销且未过期的操作记录
CREATE OR REPLACE FUNCTION get_active_operations(
  p_user_id UUID,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  action TEXT,
  folder_id BIGINT,
  folder_ids BIGINT[],
  bookmark_ids BIGINT[],
  before_state JSONB,
  after_state JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  can_undo BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    os.id,
    os.action,
    os.folder_id,
    os.folder_ids,
    os.bookmark_ids,
    os.before_state,
    os.after_state,
    os.reason,
    os.created_at,
    os.expires_at,
    (NOT os.is_undone AND os.expires_at > NOW()) AS can_undo
  FROM operation_snapshots os
  WHERE os.user_id = p_user_id
    AND NOT os.is_undone
    AND os.expires_at > NOW()
  ORDER BY os.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 标记操作为已撤销
CREATE OR REPLACE FUNCTION mark_operation_undone(
  p_operation_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE operation_snapshots
  SET
    is_undone = TRUE,
    undone_at = NOW()
  WHERE id = p_operation_id
    AND user_id = p_user_id
    AND NOT is_undone
    AND expires_at > NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 定时清理任务（需要 pg_cron 扩展）
-- 每天清理过期的操作记录
-- =============================================================================

-- 注意：此任务需要在 Supabase Dashboard 或通过 pg_cron 手动配置
-- SELECT cron.schedule(
--   'cleanup-expired-snapshots',
--   '0 3 * * *',  -- 每天凌晨 3 点
--   $$DELETE FROM operation_snapshots WHERE expires_at < NOW()$$
-- );

-- 添加注释说明
COMMENT ON TABLE operation_snapshots IS 'AI 文件夹操作快照表，支持 2 天内撤销';
COMMENT ON COLUMN operation_snapshots.action IS '操作类型: create/split/merge/rename/move';
COMMENT ON COLUMN operation_snapshots.before_state IS '操作前状态快照（JSON），用于回滚';
COMMENT ON COLUMN operation_snapshots.after_state IS '操作后状态快照（JSON），用于审计';
COMMENT ON COLUMN operation_snapshots.expires_at IS '过期时间，默认 2 天后';

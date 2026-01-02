-- Knowledge Studio P3: Incremental Update Tables
-- 增量更新表
-- 2026-01-02

-- ============================================================================
-- 报告变更集表
-- ============================================================================

CREATE TABLE IF NOT EXISTS ks_report_change_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL, -- 关联报告
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changes JSONB NOT NULL DEFAULT '[]', -- BookmarkChange[]
  impact_level TEXT NOT NULL DEFAULT 'none' CHECK (impact_level IN ('none', 'minor', 'moderate', 'major')),
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_ks_change_sets_report_id ON ks_report_change_sets(report_id);
CREATE INDEX idx_ks_change_sets_user_id ON ks_report_change_sets(user_id);
CREATE INDEX idx_ks_change_sets_processed ON ks_report_change_sets(processed);
CREATE INDEX idx_ks_change_sets_created_at ON ks_report_change_sets(created_at);

-- RLS
ALTER TABLE ks_report_change_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own change sets"
  ON ks_report_change_sets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own change sets"
  ON ks_report_change_sets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own change sets"
  ON ks_report_change_sets FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 增量更新任务表
-- ============================================================================

CREATE TABLE IF NOT EXISTS ks_incremental_update_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  change_set_id UUID NOT NULL REFERENCES ks_report_change_sets(id) ON DELETE CASCADE,
  impact_analysis JSONB NOT NULL DEFAULT '{}', -- ReportImpactAnalysis
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  error TEXT,
  new_version INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- 索引
CREATE INDEX idx_ks_update_tasks_report_id ON ks_incremental_update_tasks(report_id);
CREATE INDEX idx_ks_update_tasks_user_id ON ks_incremental_update_tasks(user_id);
CREATE INDEX idx_ks_update_tasks_status ON ks_incremental_update_tasks(status);
CREATE INDEX idx_ks_update_tasks_change_set_id ON ks_incremental_update_tasks(change_set_id);

-- RLS
ALTER TABLE ks_incremental_update_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own update tasks"
  ON ks_incremental_update_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own update tasks"
  ON ks_incremental_update_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own update tasks"
  ON ks_incremental_update_tasks FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 更新结果表
-- ============================================================================

CREATE TABLE IF NOT EXISTS ks_update_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES ks_incremental_update_tasks(id) ON DELETE CASCADE,
  report_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  success BOOLEAN NOT NULL DEFAULT true,
  new_version INTEGER NOT NULL,
  paragraphs_updated INTEGER NOT NULL DEFAULT 0,
  paragraphs_regenerated INTEGER NOT NULL DEFAULT 0,
  processing_time_ms INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_ks_update_results_task_id ON ks_update_results(task_id);
CREATE INDEX idx_ks_update_results_report_id ON ks_update_results(report_id);
CREATE INDEX idx_ks_update_results_user_id ON ks_update_results(user_id);

-- RLS
ALTER TABLE ks_update_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own update results"
  ON ks_update_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own update results"
  ON ks_update_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 报告版本历史表
-- ============================================================================

CREATE TABLE IF NOT EXISTS ks_report_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content JSONB NOT NULL, -- 报告内容快照
  bookmark_ids UUID[] DEFAULT '{}', -- 当时的书签 ID 列表
  change_summary TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'incremental', 'full_regen', 'rollback')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(report_id, version)
);

-- 索引
CREATE INDEX idx_ks_report_versions_report_id ON ks_report_versions(report_id);
CREATE INDEX idx_ks_report_versions_user_id ON ks_report_versions(user_id);
CREATE INDEX idx_ks_report_versions_version ON ks_report_versions(version);

-- RLS
ALTER TABLE ks_report_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own report versions"
  ON ks_report_versions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own report versions"
  ON ks_report_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 增量更新配置表
-- ============================================================================

CREATE TABLE IF NOT EXISTS ks_incremental_update_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  auto_detect BOOLEAN NOT NULL DEFAULT true,
  auto_update_threshold TEXT NOT NULL DEFAULT 'minor' CHECK (auto_update_threshold IN ('none', 'minor', 'moderate', 'major')),
  keep_history BOOLEAN NOT NULL DEFAULT true,
  max_history_versions INTEGER NOT NULL DEFAULT 10,
  detection_interval_minutes INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE ks_incremental_update_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own config"
  ON ks_incremental_update_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own config"
  ON ks_incremental_update_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own config"
  ON ks_incremental_update_config FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- RPC: 获取待处理变更
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pending_change_sets(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  report_id UUID,
  changes JSONB,
  impact_level TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 验证用户
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    cs.id,
    cs.report_id,
    cs.changes,
    cs.impact_level,
    cs.created_at
  FROM ks_report_change_sets cs
  WHERE cs.user_id = p_user_id
    AND cs.processed = false
  ORDER BY cs.created_at DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- RPC: 创建增量更新任务
-- ============================================================================

CREATE OR REPLACE FUNCTION create_incremental_update_task(
  p_report_id UUID,
  p_change_set_id UUID,
  p_impact_analysis JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_task_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- 验证变更集归属
  IF NOT EXISTS (
    SELECT 1 FROM ks_report_change_sets
    WHERE id = p_change_set_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Change set not found or not owned';
  END IF;

  -- 创建任务
  INSERT INTO ks_incremental_update_tasks (
    report_id,
    user_id,
    change_set_id,
    impact_analysis
  ) VALUES (
    p_report_id,
    v_user_id,
    p_change_set_id,
    p_impact_analysis
  )
  RETURNING id INTO v_task_id;

  RETURN v_task_id;
END;
$$;

-- ============================================================================
-- RPC: 获取报告更新历史
-- ============================================================================

CREATE OR REPLACE FUNCTION get_report_update_history(
  p_report_id UUID,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  version INTEGER,
  source TEXT,
  change_summary TEXT,
  paragraphs_updated INTEGER,
  paragraphs_regenerated INTEGER,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rv.id,
    rv.version,
    rv.source,
    rv.change_summary,
    COALESCE(ur.paragraphs_updated, 0),
    COALESCE(ur.paragraphs_regenerated, 0),
    COALESCE(ur.tokens_used, 0),
    rv.created_at
  FROM ks_report_versions rv
  LEFT JOIN ks_update_results ur ON ur.report_id = rv.report_id AND ur.new_version = rv.version
  WHERE rv.report_id = p_report_id
    AND rv.user_id = auth.uid()
  ORDER BY rv.version DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- RPC: 回滚到指定版本
-- ============================================================================

CREATE OR REPLACE FUNCTION rollback_report_to_version(
  p_report_id UUID,
  p_target_version INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_target_content JSONB;
  v_current_version INTEGER;
  v_new_version INTEGER;
BEGIN
  v_user_id := auth.uid();

  -- 获取目标版本
  SELECT content INTO v_target_content
  FROM ks_report_versions
  WHERE report_id = p_report_id
    AND version = p_target_version
    AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target version not found';
  END IF;

  -- 获取当前最大版本号
  SELECT COALESCE(MAX(version), 0) INTO v_current_version
  FROM ks_report_versions
  WHERE report_id = p_report_id;

  v_new_version := v_current_version + 1;

  -- 创建新版本（回滚操作）
  INSERT INTO ks_report_versions (
    report_id,
    user_id,
    version,
    content,
    change_summary,
    source
  ) VALUES (
    p_report_id,
    v_user_id,
    v_new_version,
    v_target_content,
    '回滚到版本 ' || p_target_version,
    'rollback'
  );

  RETURN jsonb_build_object(
    'success', true,
    'newVersion', v_new_version,
    'rolledBackFrom', v_current_version,
    'rolledBackTo', p_target_version
  );
END;
$$;


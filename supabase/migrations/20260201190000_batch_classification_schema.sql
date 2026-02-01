-- ============================================
-- 批量分类系统数据模型扩展
-- Version: 1.0.0
-- Date: 2026-02-01
-- ============================================

-- ============================================
-- 1. bookmarks 表扩展
-- ============================================

-- 添加导入批次关联（通过 import_history.import_batch_id 关联，无外键约束）
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS import_batch_id UUID;

-- 添加分类状态字段
-- 可选值: 'pending' | 'processing' | 'clustered' | 'confirmed' | 'manual'
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS classification_status TEXT DEFAULT 'pending';

-- 添加原始路径字段（保留导入时的浏览器书签结构）
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS original_path TEXT;

-- 添加原始路径层级拆解（JSON数组）
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS original_path_parts JSONB;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_bookmarks_import_batch_id
ON bookmarks(import_batch_id) WHERE import_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookmarks_classification_status
ON bookmarks(classification_status);

-- ============================================
-- 2. 聚类结果表
-- ============================================

CREATE TABLE IF NOT EXISTS import_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id UUID, -- 通过 import_history.import_batch_id 关联
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 聚类信息
  cluster_index INTEGER NOT NULL,
  centroid vector(1024),
  cohesion FLOAT,
  member_count INTEGER DEFAULT 0,

  -- 命名建议
  suggested_name TEXT,
  suggested_name_confidence FLOAT,

  -- 映射建议
  suggested_folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL,
  match_confidence FLOAT,
  match_type TEXT, -- 'exact' | 'fuzzy' | 'create_new'

  -- 冲突信息
  conflict_type TEXT DEFAULT 'none', -- 'none' | 'path_mismatch' | 'folder_rename' | 'ambiguous'
  conflict_details JSONB,

  -- 状态
  status TEXT DEFAULT 'pending', -- 'pending' | 'confirmed' | 'rejected' | 'modified'

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_import_clusters_batch_id
ON import_clusters(import_batch_id);

CREATE INDEX IF NOT EXISTS idx_import_clusters_user_id
ON import_clusters(user_id);

CREATE INDEX IF NOT EXISTS idx_import_clusters_status
ON import_clusters(status);

-- 启用 RLS
ALTER TABLE import_clusters ENABLE ROW LEVEL SECURITY;

-- RLS 策略
CREATE POLICY "Users can view own clusters"
ON import_clusters FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clusters"
ON import_clusters FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clusters"
ON import_clusters FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own clusters"
ON import_clusters FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- 3. 聚类成员关系表
-- ============================================

CREATE TABLE IF NOT EXISTS import_cluster_members (
  cluster_id UUID REFERENCES import_clusters(id) ON DELETE CASCADE,
  bookmark_id BIGINT REFERENCES bookmarks(id) ON DELETE CASCADE,

  -- 距离信息
  distance_to_centroid FLOAT,
  is_representative BOOLEAN DEFAULT false, -- 是否为代表元（用于命名）
  representative_type TEXT, -- 'core' | 'edge' | null

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT now(),

  PRIMARY KEY (cluster_id, bookmark_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_cluster_members_bookmark_id
ON import_cluster_members(bookmark_id);

CREATE INDEX IF NOT EXISTS idx_cluster_members_representative
ON import_cluster_members(cluster_id) WHERE is_representative = true;

-- 启用 RLS
ALTER TABLE import_cluster_members ENABLE ROW LEVEL SECURITY;

-- RLS 策略（通过 cluster 关联验证）
CREATE POLICY "Users can view own cluster members"
ON import_cluster_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM import_clusters
    WHERE import_clusters.id = import_cluster_members.cluster_id
    AND import_clusters.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own cluster members"
ON import_cluster_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM import_clusters
    WHERE import_clusters.id = import_cluster_members.cluster_id
    AND import_clusters.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own cluster members"
ON import_cluster_members FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM import_clusters
    WHERE import_clusters.id = import_cluster_members.cluster_id
    AND import_clusters.user_id = auth.uid()
  )
);

-- ============================================
-- 4. 批量导入事务表（支持撤销）
-- ============================================

CREATE TABLE IF NOT EXISTS batch_import_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID, -- 通过 import_history.import_batch_id 关联
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 导入时间
  imported_at TIMESTAMPTZ DEFAULT now(),

  -- 确认时间
  confirmed_at TIMESTAMPTZ,

  -- 撤销窗口（确认后24小时内可撤销）
  undo_deadline TIMESTAMPTZ,
  undo_available BOOLEAN DEFAULT true,

  -- 确认前状态快照（用于撤销）
  pre_confirm_snapshot JSONB,

  -- 统计信息
  total_bookmarks INTEGER DEFAULT 0,
  total_clusters INTEGER DEFAULT 0,
  auto_confirmed_count INTEGER DEFAULT 0,
  manual_confirmed_count INTEGER DEFAULT 0,
  rejected_count INTEGER DEFAULT 0,

  -- 状态
  status TEXT DEFAULT 'pending', -- 'pending' | 'processing' | 'ready' | 'confirmed' | 'undone' | 'expired'

  -- 处理模式
  structure_mode TEXT DEFAULT 'auto', -- 'preserve' | 'hybrid' | 'rebuild' | 'auto'

  -- 原始结构分析结果
  structure_analysis JSONB,

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_batch_transactions_batch_id
ON batch_import_transactions(batch_id);

CREATE INDEX IF NOT EXISTS idx_batch_transactions_user_id
ON batch_import_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_batch_transactions_status
ON batch_import_transactions(status);

CREATE INDEX IF NOT EXISTS idx_batch_transactions_undo_deadline
ON batch_import_transactions(undo_deadline)
WHERE undo_available = true AND status = 'confirmed';

-- 启用 RLS
ALTER TABLE batch_import_transactions ENABLE ROW LEVEL SECURITY;

-- RLS 策略
CREATE POLICY "Users can view own transactions"
ON batch_import_transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
ON batch_import_transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
ON batch_import_transactions FOR UPDATE
USING (auth.uid() = user_id);

-- ============================================
-- 5. 分类进度表（用于实时进度展示）
-- ============================================

CREATE TABLE IF NOT EXISTS batch_classification_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES batch_import_transactions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 当前阶段
  current_phase TEXT DEFAULT 'sedimentation', -- 'sedimentation' | 'clustering' | 'mapping' | 'completed' | 'failed'

  -- 进度百分比 (0-100)
  progress INTEGER DEFAULT 0,

  -- 各阶段详情
  phase_details JSONB DEFAULT '{
    "sedimentation": {"status": "pending", "processed": 0, "total": 0},
    "clustering": {"status": "pending", "clusters_found": 0},
    "mapping": {"status": "pending", "mapped": 0, "created": 0}
  }'::jsonb,

  -- 预估剩余时间（秒）
  estimated_remaining_seconds INTEGER,

  -- 错误信息
  error_message TEXT,
  error_details JSONB,

  -- 时间戳
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_classification_progress_transaction_id
ON batch_classification_progress(transaction_id);

CREATE INDEX IF NOT EXISTS idx_classification_progress_user_id
ON batch_classification_progress(user_id);

-- 启用 RLS
ALTER TABLE batch_classification_progress ENABLE ROW LEVEL SECURITY;

-- RLS 策略
CREATE POLICY "Users can view own progress"
ON batch_classification_progress FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
ON batch_classification_progress FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
ON batch_classification_progress FOR UPDATE
USING (auth.uid() = user_id);

-- ============================================
-- 6. 触发器：自动更新 updated_at
-- ============================================

-- import_clusters 触发器
CREATE OR REPLACE FUNCTION update_import_clusters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_import_clusters_updated_at ON import_clusters;
CREATE TRIGGER trigger_import_clusters_updated_at
  BEFORE UPDATE ON import_clusters
  FOR EACH ROW
  EXECUTE FUNCTION update_import_clusters_updated_at();

-- batch_import_transactions 触发器
CREATE OR REPLACE FUNCTION update_batch_import_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_batch_import_transactions_updated_at ON batch_import_transactions;
CREATE TRIGGER trigger_batch_import_transactions_updated_at
  BEFORE UPDATE ON batch_import_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_import_transactions_updated_at();

-- batch_classification_progress 触发器
CREATE OR REPLACE FUNCTION update_batch_classification_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_batch_classification_progress_updated_at ON batch_classification_progress;
CREATE TRIGGER trigger_batch_classification_progress_updated_at
  BEFORE UPDATE ON batch_classification_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_classification_progress_updated_at();

-- ============================================
-- 7. 触发器：自动设置 undo_deadline
-- ============================================

CREATE OR REPLACE FUNCTION set_undo_deadline()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.confirmed_at IS NOT NULL AND OLD.confirmed_at IS NULL THEN
    NEW.undo_deadline = NEW.confirmed_at + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_undo_deadline ON batch_import_transactions;
CREATE TRIGGER trigger_set_undo_deadline
  BEFORE UPDATE ON batch_import_transactions
  FOR EACH ROW
  EXECUTE FUNCTION set_undo_deadline();

-- ============================================
-- 8. 辅助函数：检查撤销是否可用
-- ============================================

CREATE OR REPLACE FUNCTION check_undo_available(transaction_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  result BOOLEAN;
BEGIN
  SELECT
    undo_available AND
    status = 'confirmed' AND
    undo_deadline > now()
  INTO result
  FROM batch_import_transactions
  WHERE id = transaction_id;

  RETURN COALESCE(result, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. 定时任务：过期撤销窗口标记
-- ============================================

CREATE OR REPLACE FUNCTION expire_undo_windows()
RETURNS INTEGER AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  UPDATE batch_import_transactions
  SET
    undo_available = false,
    status = CASE WHEN status = 'confirmed' THEN 'expired' ELSE status END
  WHERE
    undo_available = true
    AND undo_deadline < now()
    AND status = 'confirmed';

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. 注释
-- ============================================

COMMENT ON TABLE import_clusters IS '批量导入聚类结果表，存储 DBSCAN 聚类后的簇信息';
COMMENT ON TABLE import_cluster_members IS '聚类成员关系表，记录每个书签所属的簇';
COMMENT ON TABLE batch_import_transactions IS '批量导入事务表，支持 24 小时内撤销';
COMMENT ON TABLE batch_classification_progress IS '分类进度表，用于实时展示处理进度';

COMMENT ON COLUMN bookmarks.classification_status IS '分类状态: pending|processing|clustered|confirmed|manual';
COMMENT ON COLUMN bookmarks.original_path IS '导入时的原始浏览器书签路径，如 "书签栏/工作/项目A"';
COMMENT ON COLUMN import_clusters.conflict_type IS '冲突类型: none|path_mismatch|folder_rename|ambiguous';
COMMENT ON COLUMN batch_import_transactions.structure_mode IS '原始结构处理模式: preserve|hybrid|rebuild|auto';

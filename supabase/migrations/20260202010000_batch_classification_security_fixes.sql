-- ============================================
-- 批量分类系统安全修复
-- Version: 1.0.1
-- Date: 2026-02-02
-- ============================================

-- ============================================
-- 1. 修复 SQL 注入风险 - 添加用户权���检查
-- ============================================

-- 修复 check_undo_available 函数，添加用户身份验证
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
  WHERE id = transaction_id
    AND user_id = auth.uid();  -- 安全修复：添加用户权限检查

  RETURN COALESCE(result, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 修复 expire_undo_windows 函数，限制只能操作自己的数据
-- 注意：此函数用于定时任务，需要 SECURITY DEFINER 来操作所有用户数据
-- 但应该由后台任务调用，而非用户直接调用
CREATE OR REPLACE FUNCTION expire_undo_windows()
RETURNS INTEGER AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  -- 仅允许服务角色调用此函数
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Only service role can call this function';
  END IF;

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
-- 2. 补全 RLS 策略 - import_cluster_members UPDATE
-- ============================================

CREATE POLICY "Users can update own cluster members"
ON import_cluster_members FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM import_clusters
    WHERE import_clusters.id = import_cluster_members.cluster_id
    AND import_clusters.user_id = auth.uid()
  )
);

-- ============================================
-- 3. 添加进度清理函数
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_completed_progress()
RETURNS INTEGER AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  -- 仅允许服务角色调用此函数
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Only service role can call this function';
  END IF;

  DELETE FROM batch_classification_progress
  WHERE current_phase IN ('completed', 'failed')
    AND completed_at < now() - INTERVAL '7 days';

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. 优化触发器 - 使用通用函数 (DRY 原则)
-- ============================================

-- 创建通用的 updated_at 触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 更新触发器使用通用函数
DROP TRIGGER IF EXISTS trigger_import_clusters_updated_at ON import_clusters;
CREATE TRIGGER trigger_import_clusters_updated_at
  BEFORE UPDATE ON import_clusters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_batch_import_transactions_updated_at ON batch_import_transactions;
CREATE TRIGGER trigger_batch_import_transactions_updated_at
  BEFORE UPDATE ON batch_import_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_batch_classification_progress_updated_at ON batch_classification_progress;
CREATE TRIGGER trigger_batch_classification_progress_updated_at
  BEFORE UPDATE ON batch_classification_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 删除旧的冗余函数
DROP FUNCTION IF EXISTS update_import_clusters_updated_at();
DROP FUNCTION IF EXISTS update_batch_import_transactions_updated_at();
DROP FUNCTION IF EXISTS update_batch_classification_progress_updated_at();

-- ============================================
-- 5. 添加并发控制约束
-- ============================================

-- 添加唯一约束：同一批次同一用户只能有一个进行中��分类任务
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_ongoing_classification
ON batch_import_transactions(batch_id, user_id)
WHERE status IN ('pending', 'processing');

-- ============================================
-- 注释
-- ============================================

COMMENT ON FUNCTION check_undo_available IS '检查撤销是否可用，已添加用户权限验证';
COMMENT ON FUNCTION expire_undo_windows IS '过期撤销窗口标记，仅服务角色可调用';
COMMENT ON FUNCTION cleanup_completed_progress IS '清理已完成的进度记录，保留7天';
COMMENT ON FUNCTION update_updated_at_column IS '通用的 updated_at 触发器函数';

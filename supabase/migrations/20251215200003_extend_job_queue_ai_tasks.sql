-- ===========================================
-- V4.2.7: 扩展 Job Queue 支持 AI 任务
-- ===========================================
-- 添加 AI 内容生成和分类相关的任务类型
-- 支持失败重试机制

-- ============================================================================
-- 1. 修改 job_queue 的 type 约束，添加新的任务类型
-- ============================================================================

-- 先删除旧的约束
ALTER TABLE job_queue DROP CONSTRAINT IF EXISTS job_queue_type_check;

-- 添加新的约束，包含 AI 任务类型
ALTER TABLE job_queue ADD CONSTRAINT job_queue_type_check CHECK (type IN (
  -- 原有任务类型
  'process_inbox_cache',      -- 处理待整理缓存池
  'check_rename_candidates',  -- 检查重命名候选
  'check_split_candidates',   -- 检查分拆候选
  'check_merge_candidates',   -- 检查合并候选
  'generate_monthly_report',  -- 生成月度报告
  'update_folder_profiles',   -- 更新文件夹画像
  'cleanup_expired_data',     -- 清理过期数据
  -- V4.2.7: 新增 AI 任务类型
  'generate_ai_content',      -- 生成 AI 摘要和标签
  'generate_embedding',       -- 生成向量嵌入
  'classify_bookmark',        -- 书签分类
  'fetch_bookmark_content'    -- 抓取书签内容
));

COMMENT ON COLUMN job_queue.type IS '任务类型（包含文件夹进化和 AI 内容生成任务）';

-- ============================================================================
-- 2. 添加书签相关索引
-- ============================================================================

-- 用于快速查找特定书签的任务
CREATE INDEX IF NOT EXISTS idx_job_queue_bookmark_id
ON job_queue((payload->>'bookmarkId'))
WHERE payload->>'bookmarkId' IS NOT NULL;

-- ============================================================================
-- 3. 创建入队 AI 任务的便捷函数
-- ============================================================================

-- 入队 AI 内容生成任务
CREATE OR REPLACE FUNCTION enqueue_ai_content_job(
  p_user_id UUID,
  p_bookmark_id INTEGER,
  p_url TEXT,
  p_priority INT DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- 检查是否已有相同任务
  IF EXISTS (
    SELECT 1 FROM job_queue
    WHERE user_id = p_user_id
      AND type = 'generate_ai_content'
      AND status = 'pending'
      AND payload->>'bookmarkId' = p_bookmark_id::TEXT
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO job_queue (user_id, type, payload, priority, max_attempts)
  VALUES (
    p_user_id,
    'generate_ai_content',
    jsonb_build_object(
      'bookmarkId', p_bookmark_id,
      'url', p_url,
      'createdAt', NOW()
    ),
    p_priority,
    3  -- 最多重试 3 次
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enqueue_ai_content_job IS '入队 AI 内容生成任务';

-- 入队向量生成任务
CREATE OR REPLACE FUNCTION enqueue_embedding_job(
  p_user_id UUID,
  p_bookmark_id INTEGER,
  p_priority INT DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- 检查是否已有相同任务
  IF EXISTS (
    SELECT 1 FROM job_queue
    WHERE user_id = p_user_id
      AND type = 'generate_embedding'
      AND status = 'pending'
      AND payload->>'bookmarkId' = p_bookmark_id::TEXT
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO job_queue (user_id, type, payload, priority, max_attempts)
  VALUES (
    p_user_id,
    'generate_embedding',
    jsonb_build_object(
      'bookmarkId', p_bookmark_id,
      'createdAt', NOW()
    ),
    p_priority,
    3
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enqueue_embedding_job IS '入队向量生成任务';

-- 入队分类任务
CREATE OR REPLACE FUNCTION enqueue_classification_job(
  p_user_id UUID,
  p_bookmark_id INTEGER,
  p_priority INT DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- 检查是否已有相同任务
  IF EXISTS (
    SELECT 1 FROM job_queue
    WHERE user_id = p_user_id
      AND type = 'classify_bookmark'
      AND status = 'pending'
      AND payload->>'bookmarkId' = p_bookmark_id::TEXT
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO job_queue (user_id, type, payload, priority, max_attempts)
  VALUES (
    p_user_id,
    'classify_bookmark',
    jsonb_build_object(
      'bookmarkId', p_bookmark_id,
      'createdAt', NOW()
    ),
    p_priority,
    3
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enqueue_classification_job IS '入队书签分类任务';

-- ============================================================================
-- 4. 创建失败任务视图（便于监控）
-- ============================================================================

CREATE OR REPLACE VIEW failed_ai_jobs AS
SELECT
  j.id,
  j.user_id,
  j.type,
  j.payload->>'bookmarkId' as bookmark_id,
  j.error,
  j.attempts,
  j.max_attempts,
  j.created_at,
  j.completed_at
FROM job_queue j
WHERE j.status = 'failed'
  AND j.type IN ('generate_ai_content', 'generate_embedding', 'classify_bookmark', 'fetch_bookmark_content')
ORDER BY j.completed_at DESC;

COMMENT ON VIEW failed_ai_jobs IS '失败的 AI 任务列表（用于监控和重试）';

GRANT SELECT ON failed_ai_jobs TO authenticated;

-- ============================================================================
-- 5. 创建重试失败任务的函数
-- ============================================================================

CREATE OR REPLACE FUNCTION retry_failed_ai_job(
  p_job_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_job RECORD;
BEGIN
  SELECT id, user_id, type, payload, max_attempts
  INTO v_job
  FROM job_queue
  WHERE id = p_job_id
    AND status = 'failed';

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 重置任务状态
  UPDATE job_queue
  SET
    status = 'pending',
    error = NULL,
    attempts = 0,
    scheduled_at = NOW(),
    started_at = NULL,
    completed_at = NULL,
    lock_until = NULL,
    claimed_by = NULL
  WHERE id = p_job_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION retry_failed_ai_job IS '重试失败的 AI 任务';

GRANT EXECUTE ON FUNCTION retry_failed_ai_job(UUID) TO authenticated;

-- ============================================================================
-- 完成
-- ============================================================================

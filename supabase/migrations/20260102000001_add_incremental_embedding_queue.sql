-- 增量索引更新机制
--
-- 目的：当书签的标题、标签或内容变更时，自动将其加入向量更新队列
--
-- @version 1.0.0
-- @since 2026-01-02

-- ============================================================================
-- 1. 创建向量更新队列表
-- ============================================================================

CREATE TABLE IF NOT EXISTS bookmark_embedding_queue (
  id BIGSERIAL PRIMARY KEY,
  bookmark_id BIGINT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  update_type VARCHAR(20) NOT NULL CHECK (update_type IN ('title', 'tags', 'content', 'full')),
  priority INT DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),  -- 1=最高优先级, 10=最低
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  retry_count INT DEFAULT 0,
  last_error TEXT
);

-- 避免重复入队：同一书签同一类型只保留一个待处理任务（使用部分唯一索引）
CREATE UNIQUE INDEX IF NOT EXISTS uq_bookmark_embedding_queue_pending
  ON bookmark_embedding_queue (bookmark_id, update_type)
  WHERE processed_at IS NULL;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_embedding_queue_pending
  ON bookmark_embedding_queue (priority, created_at)
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_embedding_queue_user
  ON bookmark_embedding_queue (user_id)
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_embedding_queue_bookmark
  ON bookmark_embedding_queue (bookmark_id);

-- 添加 RLS 策略
ALTER TABLE bookmark_embedding_queue ENABLE ROW LEVEL SECURITY;

-- 用户只能看到自己的队列项（一般不需要，内部使用）
CREATE POLICY "Users can view own queue items"
  ON bookmark_embedding_queue FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 服务角色可以完全访问
CREATE POLICY "Service role full access"
  ON bookmark_embedding_queue FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================================================
-- 2. 创建入队函数
-- ============================================================================

CREATE OR REPLACE FUNCTION queue_embedding_update(
  p_bookmark_id BIGINT,
  p_user_id UUID,
  p_update_type VARCHAR(20),
  p_priority INT DEFAULT 5
) RETURNS VOID AS $$
DECLARE
  existing_id BIGINT;
BEGIN
  -- 检查是否已存在待处理的任务
  SELECT id INTO existing_id
  FROM bookmark_embedding_queue
  WHERE bookmark_id = p_bookmark_id
    AND update_type = p_update_type
    AND processed_at IS NULL
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    -- 更新现有任务的优先级（取更高优先级）
    UPDATE bookmark_embedding_queue
    SET priority = LEAST(priority, p_priority),
        created_at = NOW()
    WHERE id = existing_id;
  ELSE
    -- 插入新任务
    INSERT INTO bookmark_embedding_queue (bookmark_id, user_id, update_type, priority)
    VALUES (p_bookmark_id, p_user_id, p_update_type, p_priority);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 3. 创建触发器函数
-- ============================================================================

-- 标题变更触发函数
CREATE OR REPLACE FUNCTION trg_bookmark_title_change() RETURNS TRIGGER AS $$
BEGIN
  -- 仅当标题实际变化时入队
  IF OLD.title IS DISTINCT FROM NEW.title THEN
    PERFORM queue_embedding_update(NEW.id, NEW.user_id, 'title', 3);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 标签变更触发函数
CREATE OR REPLACE FUNCTION trg_bookmark_tags_change() RETURNS TRIGGER AS $$
BEGIN
  -- 用户标签或 AI 标签变化时入队
  IF OLD.user_tags IS DISTINCT FROM NEW.user_tags
     OR OLD.ai_tags IS DISTINCT FROM NEW.ai_tags THEN
    PERFORM queue_embedding_update(NEW.id, NEW.user_id, 'tags', 4);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 内容变更触发函数（摘要变化）
CREATE OR REPLACE FUNCTION trg_bookmark_content_change() RETURNS TRIGGER AS $$
BEGIN
  -- AI 摘要或描述变化时入队
  IF OLD.ai_summary IS DISTINCT FROM NEW.ai_summary
     OR OLD.description IS DISTINCT FROM NEW.description THEN
    PERFORM queue_embedding_update(NEW.id, NEW.user_id, 'content', 5);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 4. 创建触发器
-- ============================================================================

-- 删除已存在的触发器（如果有）
DROP TRIGGER IF EXISTS tr_bookmarks_title_embedding_update ON bookmarks;
DROP TRIGGER IF EXISTS tr_bookmarks_tags_embedding_update ON bookmarks;
DROP TRIGGER IF EXISTS tr_bookmarks_content_embedding_update ON bookmarks;

-- 创建触发器
CREATE TRIGGER tr_bookmarks_title_embedding_update
  AFTER UPDATE OF title ON bookmarks
  FOR EACH ROW
  WHEN (OLD.title IS DISTINCT FROM NEW.title AND NEW.deleted_at IS NULL)
  EXECUTE FUNCTION trg_bookmark_title_change();

CREATE TRIGGER tr_bookmarks_tags_embedding_update
  AFTER UPDATE OF user_tags, ai_tags ON bookmarks
  FOR EACH ROW
  WHEN ((OLD.user_tags IS DISTINCT FROM NEW.user_tags
         OR OLD.ai_tags IS DISTINCT FROM NEW.ai_tags)
        AND NEW.deleted_at IS NULL)
  EXECUTE FUNCTION trg_bookmark_tags_change();

CREATE TRIGGER tr_bookmarks_content_embedding_update
  AFTER UPDATE OF ai_summary, description ON bookmarks
  FOR EACH ROW
  WHEN ((OLD.ai_summary IS DISTINCT FROM NEW.ai_summary
         OR OLD.description IS DISTINCT FROM NEW.description)
        AND NEW.deleted_at IS NULL)
  EXECUTE FUNCTION trg_bookmark_content_change();


-- ============================================================================
-- 5. 创建批量获取待处理任务的函数
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pending_embedding_tasks(
  p_limit INT DEFAULT 50,
  p_lock_for_update BOOLEAN DEFAULT TRUE
) RETURNS TABLE (
  id BIGINT,
  bookmark_id BIGINT,
  user_id UUID,
  update_type VARCHAR(20),
  priority INT,
  created_at TIMESTAMPTZ,
  retry_count INT
) AS $$
BEGIN
  IF p_lock_for_update THEN
    -- 使用 FOR UPDATE SKIP LOCKED 避免并发冲突
    RETURN QUERY
    SELECT
      q.id, q.bookmark_id, q.user_id, q.update_type,
      q.priority, q.created_at, q.retry_count
    FROM bookmark_embedding_queue q
    WHERE q.processed_at IS NULL
      AND q.retry_count < 3
    ORDER BY q.priority ASC, q.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED;
  ELSE
    RETURN QUERY
    SELECT
      q.id, q.bookmark_id, q.user_id, q.update_type,
      q.priority, q.created_at, q.retry_count
    FROM bookmark_embedding_queue q
    WHERE q.processed_at IS NULL
      AND q.retry_count < 3
    ORDER BY q.priority ASC, q.created_at ASC
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 6. 创建标记任务完成/失败的函数
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_embedding_task_completed(
  p_task_ids BIGINT[]
) RETURNS INT AS $$
DECLARE
  affected_count INT;
BEGIN
  UPDATE bookmark_embedding_queue
  SET processed_at = NOW()
  WHERE id = ANY(p_task_ids)
    AND processed_at IS NULL;

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION mark_embedding_task_failed(
  p_task_id BIGINT,
  p_error_message TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE bookmark_embedding_queue
  SET
    retry_count = retry_count + 1,
    last_error = p_error_message
  WHERE id = p_task_id
    AND processed_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 7. 创建队列统计视图
-- ============================================================================

CREATE OR REPLACE VIEW embedding_queue_stats AS
SELECT
  COUNT(*) FILTER (WHERE processed_at IS NULL) AS pending_count,
  COUNT(*) FILTER (WHERE processed_at IS NOT NULL AND processed_at > NOW() - INTERVAL '24 hours') AS processed_24h,
  COUNT(*) FILTER (WHERE retry_count >= 3 AND processed_at IS NULL) AS failed_count,
  COUNT(*) FILTER (WHERE processed_at IS NULL AND update_type = 'title') AS pending_title,
  COUNT(*) FILTER (WHERE processed_at IS NULL AND update_type = 'tags') AS pending_tags,
  COUNT(*) FILTER (WHERE processed_at IS NULL AND update_type = 'content') AS pending_content,
  COUNT(*) FILTER (WHERE processed_at IS NULL AND update_type = 'full') AS pending_full,
  MIN(created_at) FILTER (WHERE processed_at IS NULL) AS oldest_pending,
  AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) FILTER (WHERE processed_at IS NOT NULL AND processed_at > NOW() - INTERVAL '24 hours') AS avg_processing_time_seconds
FROM bookmark_embedding_queue;


-- ============================================================================
-- 8. 添加注释
-- ============================================================================

COMMENT ON TABLE bookmark_embedding_queue IS '书签向量更新队列，用于增量索引更新';
COMMENT ON COLUMN bookmark_embedding_queue.update_type IS '更新类型：title=标题向量, tags=标签向量, content=内容向量, full=全部向量';
COMMENT ON COLUMN bookmark_embedding_queue.priority IS '优先级 1-10，数字越小优先级越高';
COMMENT ON COLUMN bookmark_embedding_queue.retry_count IS '重试次数，超过 3 次标记为失败';
COMMENT ON FUNCTION queue_embedding_update IS '将书签加入向量更新队列';
COMMENT ON FUNCTION get_pending_embedding_tasks IS '获取待处理的向量更新任务，支持行锁';
COMMENT ON VIEW embedding_queue_stats IS '向量更新队列统计信息';

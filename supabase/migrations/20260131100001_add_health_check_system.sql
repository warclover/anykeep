-- ============================================
-- Health Check System - 统一健康检测
-- ============================================
-- 将链接检测、重复内容、过期内容统一为健康检测系统

-- 1. 健康检测缓存表 (避免重复检测)
CREATE TABLE IF NOT EXISTS health_check_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- 检测类型
  check_type TEXT NOT NULL,               -- 'broken_link', 'duplicate', 'stale'

  -- 关联书签
  bookmark_id UUID REFERENCES bookmarks(id) ON DELETE CASCADE,
  related_bookmark_ids UUID[],            -- 重复检测时的关联书签

  -- 检测结果
  status TEXT NOT NULL DEFAULT 'issue',   -- 'issue', 'resolved', 'ignored'
  severity TEXT DEFAULT 'medium',         -- 'low', 'medium', 'high'
  details JSONB DEFAULT '{}',             -- 详细信息 (HTTP状态码、相似度等)

  -- 用户操作
  ignored_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_action TEXT,                 -- 'deleted', 'updated', 'merged', 'archived'

  -- 时间戳
  detected_at TIMESTAMPTZ DEFAULT now(),
  last_checked_at TIMESTAMPTZ DEFAULT now(),

  -- 唯一约束：同一用户、同一类型、同一书签只有一条记录
  UNIQUE(user_id, check_type, bookmark_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_health_cache_user_type
  ON health_check_cache(user_id, check_type);
CREATE INDEX IF NOT EXISTS idx_health_cache_status
  ON health_check_cache(status) WHERE status = 'issue';
CREATE INDEX IF NOT EXISTS idx_health_cache_bookmark
  ON health_check_cache(bookmark_id);
CREATE INDEX IF NOT EXISTS idx_health_cache_detected
  ON health_check_cache(detected_at DESC);

-- 2. 书签表新增访问追踪字段 (用于过期检测)
ALTER TABLE bookmarks
  ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;

-- 创建索引用于过期内容查询
CREATE INDEX IF NOT EXISTS idx_bookmarks_last_accessed
  ON bookmarks(last_accessed_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bookmarks_stale_detection
  ON bookmarks(user_id, last_accessed_at, created_at)
  WHERE deleted_at IS NULL;

-- 3. 健康检测历史表 (记录每次全量检测)
CREATE TABLE IF NOT EXISTS health_check_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- 检测范围
  check_types TEXT[] NOT NULL DEFAULT ARRAY['broken_link', 'duplicate', 'stale'],
  scope TEXT DEFAULT 'all',               -- 'all', 'folder', 'selected'
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,

  -- 检测统计
  total_checked INTEGER DEFAULT 0,
  broken_links_count INTEGER DEFAULT 0,
  duplicates_count INTEGER DEFAULT 0,
  stale_count INTEGER DEFAULT 0,

  -- 状态
  status TEXT DEFAULT 'running',          -- 'running', 'completed', 'failed', 'cancelled'
  progress INTEGER DEFAULT 0,             -- 0-100
  error_message TEXT,

  -- 时间戳
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_health_runs_user
  ON health_check_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_runs_status
  ON health_check_runs(status) WHERE status = 'running';

-- 4. RLS 策略
ALTER TABLE health_check_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_check_runs ENABLE ROW LEVEL SECURITY;

-- health_check_cache 策略
CREATE POLICY "Users can view own health cache" ON health_check_cache
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health cache" ON health_check_cache
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health cache" ON health_check_cache
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own health cache" ON health_check_cache
  FOR DELETE USING (auth.uid() = user_id);

-- health_check_runs 策略
CREATE POLICY "Users can view own health runs" ON health_check_runs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health runs" ON health_check_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health runs" ON health_check_runs
  FOR UPDATE USING (auth.uid() = user_id);

-- 5. 辅助函数：记录书签访问
CREATE OR REPLACE FUNCTION record_bookmark_access(p_bookmark_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE bookmarks
  SET
    last_accessed_at = now(),
    access_count = COALESCE(access_count, 0) + 1
  WHERE id = p_bookmark_id
    AND user_id = auth.uid();
END;
$$;

-- 6. 辅助函数：获取健康概览统计
CREATE OR REPLACE FUNCTION get_health_overview(p_user_id UUID)
RETURNS TABLE (
  broken_links_count BIGINT,
  duplicates_count BIGINT,
  stale_count BIGINT,
  total_issues BIGINT,
  last_checked_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE check_type = 'broken_link' AND status = 'issue') as broken_links_count,
    COUNT(*) FILTER (WHERE check_type = 'duplicate' AND status = 'issue') as duplicates_count,
    COUNT(*) FILTER (WHERE check_type = 'stale' AND status = 'issue') as stale_count,
    COUNT(*) FILTER (WHERE status = 'issue') as total_issues,
    MAX(last_checked_at) as last_checked_at
  FROM health_check_cache
  WHERE user_id = p_user_id;
END;
$$;

-- 7. 辅助函数：获取过期书签
CREATE OR REPLACE FUNCTION get_stale_bookmarks(
  p_user_id UUID,
  p_days_threshold INTEGER DEFAULT 90,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  bookmark_id UUID,
  title TEXT,
  url TEXT,
  folder_id UUID,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  days_since_access INTEGER,
  access_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id as bookmark_id,
    b.title,
    b.url,
    b.folder_id,
    b.last_accessed_at,
    b.created_at,
    COALESCE(
      EXTRACT(DAY FROM now() - b.last_accessed_at)::INTEGER,
      EXTRACT(DAY FROM now() - b.created_at)::INTEGER
    ) as days_since_access,
    COALESCE(b.access_count, 0)::INTEGER as access_count
  FROM bookmarks b
  WHERE b.user_id = p_user_id
    AND b.deleted_at IS NULL
    AND (
      -- 从未访问过，且创建时间超过阈值
      (b.last_accessed_at IS NULL AND b.created_at < now() - (p_days_threshold || ' days')::INTERVAL)
      OR
      -- 最后访问时间超过阈值
      (b.last_accessed_at IS NOT NULL AND b.last_accessed_at < now() - (p_days_threshold || ' days')::INTERVAL)
    )
  ORDER BY
    COALESCE(b.last_accessed_at, b.created_at) ASC
  LIMIT p_limit;
END;
$$;

-- 8. 辅助函数：批量更新健康状态
CREATE OR REPLACE FUNCTION batch_upsert_health_cache(
  p_user_id UUID,
  p_items JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  v_item JSONB;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO health_check_cache (
      user_id,
      check_type,
      bookmark_id,
      related_bookmark_ids,
      status,
      severity,
      details,
      detected_at,
      last_checked_at
    )
    VALUES (
      p_user_id,
      v_item->>'check_type',
      (v_item->>'bookmark_id')::UUID,
      CASE
        WHEN v_item->'related_bookmark_ids' IS NOT NULL
        THEN ARRAY(SELECT jsonb_array_elements_text(v_item->'related_bookmark_ids'))::UUID[]
        ELSE NULL
      END,
      COALESCE(v_item->>'status', 'issue'),
      COALESCE(v_item->>'severity', 'medium'),
      COALESCE(v_item->'details', '{}'),
      now(),
      now()
    )
    ON CONFLICT (user_id, check_type, bookmark_id)
    DO UPDATE SET
      status = COALESCE(EXCLUDED.status, health_check_cache.status),
      severity = COALESCE(EXCLUDED.severity, health_check_cache.severity),
      details = COALESCE(EXCLUDED.details, health_check_cache.details),
      last_checked_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 9. 辅助函数：清理已解决的问题
CREATE OR REPLACE FUNCTION cleanup_resolved_health_issues(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- 删除已解决或忽略超过30天的记录
  DELETE FROM health_check_cache
  WHERE user_id = p_user_id
    AND status IN ('resolved', 'ignored')
    AND COALESCE(resolved_at, ignored_at) < now() - INTERVAL '30 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 添加注释
COMMENT ON TABLE health_check_cache IS '健康检测缓存表 - 存储检测结果避免重复检测';
COMMENT ON TABLE health_check_runs IS '健康检测运行记录 - 记录每次全量检测的历史';
COMMENT ON COLUMN bookmarks.last_accessed_at IS '最后访问时间 - 用于过期内容检测';
COMMENT ON COLUMN bookmarks.access_count IS '访问次数 - 用于过期内容检测';

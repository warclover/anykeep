-- ============================================
-- 链接健康检测功能数据库迁移
-- 版本: 1.0.0
-- 日期: 2025-12-27
-- ============================================

-- 1. 创建链接健康检测历史表
CREATE TABLE IF NOT EXISTS link_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 检测范围
  scope TEXT NOT NULL DEFAULT 'all',  -- 'all' | 'folder' | 'selected'
  folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
  bookmark_ids INTEGER[],  -- 仅当 scope='selected' 时使用

  -- 检测结果统计
  total_checked INTEGER NOT NULL DEFAULT 0,
  healthy_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  slow_count INTEGER NOT NULL DEFAULT 0,
  redirect_count INTEGER NOT NULL DEFAULT 0,

  -- 问题详情（JSONB 存储）
  problems JSONB NOT NULL DEFAULT '[]',
  -- 结构: [{ bookmarkId, url, status, errorType, errorMessage, responseTime, checkedAt }]

  -- 状态
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress INTEGER NOT NULL DEFAULT 0,  -- 0-100

  -- 时间戳
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 约束
  CONSTRAINT valid_scope CHECK (scope IN ('all', 'folder', 'selected')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  CONSTRAINT valid_progress CHECK (progress >= 0 AND progress <= 100)
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_link_health_checks_user_id
  ON link_health_checks(user_id);

CREATE INDEX IF NOT EXISTS idx_link_health_checks_status
  ON link_health_checks(status);

CREATE INDEX IF NOT EXISTS idx_link_health_checks_created_at
  ON link_health_checks(created_at DESC);

-- 复合索引：用户最新检测
CREATE INDEX IF NOT EXISTS idx_link_health_checks_user_latest
  ON link_health_checks(user_id, created_at DESC);

-- 3. 启用 RLS
ALTER TABLE link_health_checks ENABLE ROW LEVEL SECURITY;

-- 4. RLS 策略
CREATE POLICY "Users can view own health checks"
  ON link_health_checks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health checks"
  ON link_health_checks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health checks"
  ON link_health_checks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own health checks"
  ON link_health_checks FOR DELETE
  USING (auth.uid() = user_id);

-- 5. 为 bookmarks 表添加健康状态字段
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS health_checked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS health_error_type TEXT,
ADD COLUMN IF NOT EXISTS health_response_time_ms INTEGER;

-- 6. 添加健康状态约束（使用 DO 块避免重复添加）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_health_status' AND conrelid = 'bookmarks'::regclass
  ) THEN
    ALTER TABLE bookmarks
    ADD CONSTRAINT valid_health_status
    CHECK (health_status IN ('unknown', 'healthy', 'slow', 'redirect', 'failed', 'ignored'));
  END IF;
END $$;

-- 7. 创建健康状态索引（排除已删除的书签）
CREATE INDEX IF NOT EXISTS idx_bookmarks_health_status
  ON bookmarks(health_status)
  WHERE deleted_at IS NULL;

-- 复合索引：用户的失效链接
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_failed_health
  ON bookmarks(user_id, health_status)
  WHERE deleted_at IS NULL AND health_status = 'failed';

-- 8. 添加字段注释
COMMENT ON TABLE link_health_checks IS '链接健康检测历史记录表';
COMMENT ON COLUMN link_health_checks.scope IS '检测范围: all=全部, folder=文件夹, selected=选中';
COMMENT ON COLUMN link_health_checks.problems IS '问题详情 JSON 数组';
COMMENT ON COLUMN link_health_checks.status IS '检测状态: pending/running/completed/failed/cancelled';

COMMENT ON COLUMN bookmarks.health_status IS '链接健康状态: unknown/healthy/slow/redirect/failed/ignored';
COMMENT ON COLUMN bookmarks.health_checked_at IS '最后检测时间';
COMMENT ON COLUMN bookmarks.health_error_type IS '错误类型: not_found/timeout/ssl_error/dns_error/connection_refused';
COMMENT ON COLUMN bookmarks.health_response_time_ms IS '响应时间（毫秒）';

-- 9. 创建获取用户健康统计的函数
CREATE OR REPLACE FUNCTION get_user_health_stats(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total', COUNT(*),
    'healthy', COUNT(*) FILTER (WHERE health_status = 'healthy'),
    'failed', COUNT(*) FILTER (WHERE health_status = 'failed'),
    'slow', COUNT(*) FILTER (WHERE health_status = 'slow'),
    'redirect', COUNT(*) FILTER (WHERE health_status = 'redirect'),
    'unknown', COUNT(*) FILTER (WHERE health_status = 'unknown'),
    'ignored', COUNT(*) FILTER (WHERE health_status = 'ignored')
  ) INTO result
  FROM bookmarks
  WHERE user_id = p_user_id AND deleted_at IS NULL;

  RETURN result;
END;
$$;

-- 10. 创建批量更新健康状态的函数
CREATE OR REPLACE FUNCTION batch_update_health_status(
  p_user_id UUID,
  p_updates JSONB  -- [{ bookmarkId, status, errorType, responseTimeMs }]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  update_count INTEGER := 0;
  item JSONB;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    UPDATE bookmarks
    SET
      health_status = item->>'status',
      health_error_type = item->>'errorType',
      health_response_time_ms = (item->>'responseTimeMs')::INTEGER,
      health_checked_at = now()
    WHERE id = (item->>'bookmarkId')::INTEGER
      AND user_id = p_user_id
      AND deleted_at IS NULL;

    IF FOUND THEN
      update_count := update_count + 1;
    END IF;
  END LOOP;

  RETURN update_count;
END;
$$;

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION get_user_health_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION batch_update_health_status(UUID, JSONB) TO authenticated;

-- ============================================================================
-- 数据库审计日志系统
-- ============================================================================
-- 创建日期: 2025-12-24
-- 说明: 记录关键表的数据变更历史，支持合规审计和数据追溯

-- 1. 创建审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,

  -- 事件信息
  event_type TEXT NOT NULL CHECK (event_type IN ('INSERT', 'UPDATE', 'DELETE')),
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 表信息
  schema_name TEXT NOT NULL DEFAULT 'public',
  table_name TEXT NOT NULL,
  record_id TEXT,  -- 被操作记录的 ID

  -- 用户信息
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  client_ip INET,
  user_agent TEXT,

  -- 变更详情
  old_data JSONB,  -- 变更前数据 (UPDATE/DELETE)
  new_data JSONB,  -- 变更后数据 (INSERT/UPDATE)
  changed_fields TEXT[],  -- UPDATE 时变更的字段列表

  -- 上下文
  request_id TEXT,  -- 可用于关联同一请求的多个操作
  context JSONB,  -- 额外上下文信息 (如操作来源、关联功能等)

  -- 索引优化
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- 3. 创建审计触发器函数
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
  v_changed_fields TEXT[];
  v_record_id TEXT;
  v_key TEXT;
BEGIN
  -- 获取当前用户信息
  v_user_id := auth.uid();

  -- 尝试获取用户邮箱
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  -- 根据操作类型处理数据
  IF TG_OP = 'INSERT' THEN
    v_new_data := to_jsonb(NEW);
    v_old_data := NULL;
    v_record_id := NEW.id::TEXT;

  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    v_record_id := NEW.id::TEXT;

    -- 计算变更的字段
    v_changed_fields := ARRAY[]::TEXT[];
    FOR v_key IN SELECT jsonb_object_keys(v_new_data)
    LOOP
      IF v_old_data->v_key IS DISTINCT FROM v_new_data->v_key THEN
        v_changed_fields := array_append(v_changed_fields, v_key);
      END IF;
    END LOOP;

    -- 如果没有实际变更，跳过审计
    IF array_length(v_changed_fields, 1) IS NULL THEN
      RETURN NEW;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    v_record_id := OLD.id::TEXT;
  END IF;

  -- 插入审计日志
  INSERT INTO audit_logs (
    event_type,
    schema_name,
    table_name,
    record_id,
    user_id,
    user_email,
    old_data,
    new_data,
    changed_fields
  ) VALUES (
    TG_OP,
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    v_record_id,
    v_user_id,
    v_user_email,
    v_old_data,
    v_new_data,
    v_changed_fields
  );

  -- 返回适当的记录
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 为关键表添加审计触发器

-- 4.1 bookmarks 表审计
DROP TRIGGER IF EXISTS audit_bookmarks_trigger ON bookmarks;
CREATE TRIGGER audit_bookmarks_trigger
  AFTER INSERT OR UPDATE OR DELETE ON bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_func();

-- 4.2 folders 表审计
DROP TRIGGER IF EXISTS audit_folders_trigger ON folders;
CREATE TRIGGER audit_folders_trigger
  AFTER INSERT OR UPDATE OR DELETE ON folders
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_func();

-- 4.3 browser_bookmark_folders 表审计
--DROP TRIGGER IF EXISTS audit_browser_bookmark_folders_trigger ON browser_bookmark_folders;
--CREATE TRIGGER audit_browser_bookmark_folders_trigger
  --AFTER INSERT OR UPDATE OR DELETE ON browser_bookmark_folders
  --FOR EACH ROW
  --EXECUTE FUNCTION audit_trigger_func();

-- 5. 创建审计日志查询函数

-- 5.1 查询用户操作历史
CREATE OR REPLACE FUNCTION get_user_audit_history(
  p_user_id UUID DEFAULT auth.uid(),
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0,
  p_table_name TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  event_type TEXT,
  event_timestamp TIMESTAMPTZ,
  table_name TEXT,
  record_id TEXT,
  changed_fields TEXT[],
  old_data JSONB,
  new_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.event_type,
    al.event_timestamp,
    al.table_name,
    al.record_id,
    al.changed_fields,
    al.old_data,
    al.new_data
  FROM audit_logs al
  WHERE al.user_id = p_user_id
    AND (p_table_name IS NULL OR al.table_name = p_table_name)
    AND (p_start_date IS NULL OR al.event_timestamp >= p_start_date)
    AND (p_end_date IS NULL OR al.event_timestamp <= p_end_date)
  ORDER BY al.event_timestamp DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.2 查询记录变更历史
CREATE OR REPLACE FUNCTION get_record_audit_history(
  p_table_name TEXT,
  p_record_id TEXT
)
RETURNS TABLE (
  id BIGINT,
  event_type TEXT,
  event_timestamp TIMESTAMPTZ,
  user_email TEXT,
  changed_fields TEXT[],
  old_data JSONB,
  new_data JSONB
) AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  -- 只返回用户自己的记录变更历史
  RETURN QUERY
  SELECT
    al.id,
    al.event_type,
    al.event_timestamp,
    al.user_email,
    al.changed_fields,
    al.old_data,
    al.new_data
  FROM audit_logs al
  WHERE al.table_name = p_table_name
    AND al.record_id = p_record_id
    AND al.user_id = v_user_id
  ORDER BY al.event_timestamp DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.3 获取审计统计
CREATE OR REPLACE FUNCTION get_audit_statistics(
  p_user_id UUID DEFAULT auth.uid(),
  p_days INT DEFAULT 30
)
RETURNS TABLE (
  table_name TEXT,
  insert_count BIGINT,
  update_count BIGINT,
  delete_count BIGINT,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.table_name,
    COUNT(*) FILTER (WHERE al.event_type = 'INSERT') as insert_count,
    COUNT(*) FILTER (WHERE al.event_type = 'UPDATE') as update_count,
    COUNT(*) FILTER (WHERE al.event_type = 'DELETE') as delete_count,
    COUNT(*) as total_count
  FROM audit_logs al
  WHERE al.user_id = p_user_id
    AND al.event_timestamp >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY al.table_name
  ORDER BY total_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 添加 RLS 策略
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的审计日志
CREATE POLICY "Users can view own audit logs"
  ON audit_logs
  FOR SELECT
  USING (user_id = auth.uid());

-- 只有系统可以插入审计日志（通过触发器）
CREATE POLICY "System can insert audit logs"
  ON audit_logs
  FOR INSERT
  WITH CHECK (true);

-- 7. 创建定期清理函数（可选，保留 90 天数据）
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(
  p_retention_days INT DEFAULT 90
)
RETURNS INT AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  DELETE FROM audit_logs
  WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. 添加注释
COMMENT ON TABLE audit_logs IS '数据库审计日志表，记录关键表的数据变更历史';
COMMENT ON FUNCTION audit_trigger_func() IS '审计触发器函数，自动记录表变更';
COMMENT ON FUNCTION get_user_audit_history(UUID, INT, INT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) IS '查询用户操作历史';
COMMENT ON FUNCTION get_record_audit_history(TEXT, TEXT) IS '查询特定记录的变更历史';
COMMENT ON FUNCTION get_audit_statistics(UUID, INT) IS '获取审计统计信息';
COMMENT ON FUNCTION cleanup_old_audit_logs(INT) IS '清理过期审计日志';

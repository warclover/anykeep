-- V4.2 P1-4: 添加原子性自定义兴趣插入函数
-- 解决 N+1 查询和竞态条件问题

/**
 * 原子性添加自定义兴趣
 * 在单次事务中检查限制并插入，避免竞态条件
 *
 * @param p_user_id 用户ID
 * @param p_name 兴趣名称
 * @param p_icon 图标
 * @param p_keywords 关键词数组
 * @param p_suggested_folders 建议文件夹数组
 * @param p_max_count 最大允许数量
 * @returns 新创建的兴趣记录，若超限则返回 NULL
 */
CREATE OR REPLACE FUNCTION add_custom_interest_atomic(
  p_user_id UUID,
  p_name TEXT,
  p_icon TEXT,
  p_keywords TEXT[] DEFAULT '{}',
  p_suggested_folders TEXT[] DEFAULT '{}',
  p_max_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  name TEXT,
  icon TEXT,
  keywords TEXT[],
  suggested_folders TEXT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  error_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_count INTEGER;
  new_record RECORD;
BEGIN
  -- 获取当前数量（使用行锁防止并发问题）
  SELECT COUNT(*) INTO current_count
  FROM user_custom_interests uci
  WHERE uci.user_id = p_user_id
  FOR UPDATE;

  -- 检查是否超限
  IF current_count >= p_max_count THEN
    RETURN QUERY SELECT
      NULL::UUID,
      NULL::UUID,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT[],
      NULL::TEXT[],
      NULL::TIMESTAMPTZ,
      NULL::TIMESTAMPTZ,
      'MAX_LIMIT_EXCEEDED'::TEXT;
    RETURN;
  END IF;

  -- 插入新记录
  INSERT INTO user_custom_interests (
    user_id,
    name,
    icon,
    keywords,
    suggested_folders
  )
  VALUES (
    p_user_id,
    p_name,
    p_icon,
    p_keywords,
    p_suggested_folders
  )
  RETURNING * INTO new_record;

  -- 返回新记录
  RETURN QUERY SELECT
    new_record.id,
    new_record.user_id,
    new_record.name,
    new_record.icon,
    new_record.keywords,
    new_record.suggested_folders,
    new_record.created_at,
    new_record.updated_at,
    NULL::TEXT;
END;
$$;

-- 添加注释
COMMENT ON FUNCTION add_custom_interest_atomic IS
  'Atomically add a custom interest with limit check. Returns error_code if limit exceeded.';

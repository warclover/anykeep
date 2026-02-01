-- =====================================================
-- Synthesis Recommend 性能优化 RPC 函数
-- 解决 N+1 查询问题：50次查询 → 2次查询
-- @version 1.0.0
-- @since 2026-02-01
-- =====================================================

-- 清理所有可能存在的旧版本函数（使用 DO 块遍历删除）
DO $$
DECLARE
  func_record RECORD;
BEGIN
  -- 删除所有 get_folder_bookmark_stats 函数
  FOR func_record IN
    SELECT oid::regprocedure as func_signature
    FROM pg_proc
    WHERE proname = 'get_folder_bookmark_stats'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.func_signature || ' CASCADE';
  END LOOP;

  -- 删除所有 get_tag_bookmark_stats 函数
  FOR func_record IN
    SELECT oid::regprocedure as func_signature
    FROM pg_proc
    WHERE proname = 'get_tag_bookmark_stats'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.func_signature || ' CASCADE';
  END LOOP;
END $$;

-- 1. 获取文件夹书签统计（替代循环查询）
-- @version 1.1.0 - 添加权限检查和超时保护
CREATE OR REPLACE FUNCTION get_folder_bookmark_stats(
  p_user_id UUID,
  p_min_count INT DEFAULT 5
)
RETURNS TABLE (
  folder_id INT,
  folder_name TEXT,
  bookmark_count BIGINT,
  sample_bookmarks JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '5s'  -- 强制 5 秒超时防止慢查询
AS $$
BEGIN
  -- 🔒 安全检查：验证调用者只能查询自己的数据
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Cannot query other user data'
      USING HINT = 'p_user_id must match authenticated user ID';
  END IF;

  RETURN QUERY
  WITH folder_stats AS (
    SELECT
      f.id,
      f.name,
      COUNT(b.id) as cnt,
      ARRAY_AGG(
        jsonb_build_object('id', b.id::text, 'title', COALESCE(b.title, '无标题'))
        ORDER BY b.created_at DESC
      ) FILTER (WHERE b.id IS NOT NULL) as samples
    FROM folders f
    LEFT JOIN bookmarks b ON b.folder_id = f.id AND b.user_id = p_user_id
    WHERE f.user_id = p_user_id
      AND f.is_archived = false
      AND (f.is_system_folder IS NULL OR f.is_system_folder = false)
    GROUP BY f.id, f.name
    HAVING COUNT(b.id) >= p_min_count
  )
  SELECT
    fs.id as folder_id,
    fs.name as folder_name,
    fs.cnt as bookmark_count,
    COALESCE(
      (SELECT jsonb_agg(elem) FROM unnest(fs.samples[1:3]) as elem),
      '[]'::jsonb
    ) as sample_bookmarks
  FROM folder_stats fs
  ORDER BY fs.cnt DESC;
END;
$$;

-- 2. 获取标签书签统计（替代内存遍历）
-- @version 1.1.0 - 添加权限检查、超时保护和数组长度限制
CREATE OR REPLACE FUNCTION get_tag_bookmark_stats(
  p_user_id UUID,
  p_min_count INT DEFAULT 5,
  p_limit INT DEFAULT 5
)
RETURNS TABLE (
  tag TEXT,
  bookmark_count BIGINT,
  sample_bookmarks JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '5s'  -- 强制 5 秒超时防止慢查询
AS $$
BEGIN
  -- 🔒 安全检查：验证调用者只能查询自己的数据
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Cannot query other user data'
      USING HINT = 'p_user_id must match authenticated user ID';
  END IF;

  RETURN QUERY
  WITH tag_expanded AS (
    SELECT
      b.id,
      b.title,
      -- 🔒 安全限制：最多处理前 100 个标签，防止恶意数据导致 OOM
      unnest(b.ai_tags[1:100]) as tag_name
    FROM bookmarks b
    WHERE b.user_id = p_user_id
      AND b.ai_tags IS NOT NULL
      AND array_length(b.ai_tags, 1) > 0
  ),
  tag_stats AS (
    SELECT
      te.tag_name,
      COUNT(*) as cnt,
      ARRAY_AGG(
        jsonb_build_object('id', te.id::text, 'title', COALESCE(te.title, '无标题'))
      ) as samples
    FROM tag_expanded te
    GROUP BY te.tag_name
    HAVING COUNT(*) >= p_min_count
    ORDER BY COUNT(*) DESC
    LIMIT p_limit
  )
  SELECT
    ts.tag_name as tag,
    ts.cnt as bookmark_count,
    COALESCE(
      (SELECT jsonb_agg(elem) FROM unnest(ts.samples[1:3]) as elem),
      '[]'::jsonb
    ) as sample_bookmarks
  FROM tag_stats ts;
END;
$$;

-- 3. 授权
GRANT EXECUTE ON FUNCTION get_folder_bookmark_stats(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tag_bookmark_stats(UUID, INT, INT) TO authenticated;

-- 添加注释
COMMENT ON FUNCTION get_folder_bookmark_stats IS '获取用户文件夹书签统计，用于 synthesis/recommend API 性能优化';
COMMENT ON FUNCTION get_tag_bookmark_stats IS '获取用户标签书签统计，用于 synthesis/recommend API 性能优化';

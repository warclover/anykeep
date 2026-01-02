-- ============================================================================
-- RLS 策略性能诊断 SQL
-- 用户: warclover@163.com
-- 生成时间: 2026-01-01
--
-- 使用方法: 在 Supabase SQL Editor 中逐段执行
-- ============================================================================

-- ============================================================================
-- STEP 1: 获取用户 UUID
-- ============================================================================

-- 首先找到用户的 UUID（auth.users 表）
SELECT id, email, created_at
FROM auth.users
WHERE email = 'warclover@163.com';

-- 将下面所有 :user_id 替换为上面查询到的 UUID
-- 例如: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

-- ============================================================================
-- STEP 2: 用户数据统计概览
-- ============================================================================

-- 查看用户的书签总量和分布
WITH user_id_cte AS (
  SELECT id FROM auth.users WHERE email = 'warclover@163.com' LIMIT 1
)
SELECT
  COUNT(*) AS total_bookmarks,
  COUNT(*) FILTER (WHERE deleted_at IS NULL) AS active_bookmarks,
  COUNT(*) FILTER (WHERE is_in_trash = true) AS trashed_bookmarks,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND is_in_trash = false) AS visible_bookmarks,
  COUNT(DISTINCT platform) AS platform_count,
  COUNT(DISTINCT folder_id) AS folder_count
FROM bookmarks
WHERE user_id = (SELECT id FROM user_id_cte);

-- ============================================================================
-- STEP 3: 检查 bookmarks 表的现有索引
-- ============================================================================

SELECT
  indexname,
  indexdef,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_indexes
JOIN pg_class ON pg_class.relname = pg_indexes.indexname
WHERE tablename = 'bookmarks'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================================================
-- STEP 4: 检查 RLS 策略定义
-- ============================================================================

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS policy_condition,
  with_check
FROM pg_policies
WHERE tablename = 'bookmarks'
ORDER BY policyname;

-- ============================================================================
-- STEP 5: 首页查询性能分析（核心诊断）
-- ============================================================================

-- 5.1 默认首页查询（排除浏览器书签）
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  b.*,
  f.name AS folder_name
FROM bookmarks b
LEFT JOIN folders f ON b.folder_id = f.id
WHERE b.user_id = (SELECT id FROM auth.users WHERE email = 'warclover@163.com' LIMIT 1)
  AND b.deleted_at IS NULL
  AND b.is_in_trash = false
  AND b.platform NOT IN ('BROWSER_CHROME', 'BROWSER_EDGE', 'BROWSER_FIREFOX', 'BROWSER_SAFARI')
ORDER BY b.created_at DESC
LIMIT 20;

-- 5.2 浏览器书签查询
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  b.*,
  f.name AS folder_name
FROM bookmarks b
LEFT JOIN folders f ON b.folder_id = f.id
WHERE b.user_id = (SELECT id FROM auth.users WHERE email = 'warclover@163.com' LIMIT 1)
  AND b.deleted_at IS NULL
  AND b.is_in_trash = false
  AND b.platform IN ('BROWSER_CHROME', 'BROWSER_EDGE', 'BROWSER_FIREFOX', 'BROWSER_SAFARI')
ORDER BY b.created_at DESC
LIMIT 20;

-- 5.3 垃圾箱查询
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  b.*,
  f.name AS folder_name
FROM bookmarks b
LEFT JOIN folders f ON b.folder_id = f.id
WHERE b.user_id = (SELECT id FROM auth.users WHERE email = 'warclover@163.com' LIMIT 1)
  AND b.deleted_at IS NULL
  AND b.is_in_trash = true
ORDER BY b.created_at DESC
LIMIT 20;

-- ============================================================================
-- STEP 6: RLS 开销对比测试
-- ============================================================================

-- 6.1 关闭 RLS 后的查询时间（仅管理员可执行）
-- 注意：这需要 service_role 权限
/*
SET ROLE postgres;
ALTER TABLE bookmarks DISABLE ROW LEVEL SECURITY;

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM bookmarks
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'warclover@163.com' LIMIT 1)
  AND deleted_at IS NULL
  AND is_in_trash = false
ORDER BY created_at DESC
LIMIT 20;

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
RESET ROLE;
*/

-- ============================================================================
-- STEP 7: 表统计信息
-- ============================================================================

-- 7.1 bookmarks 表大小和行数
SELECT
  relname AS table_name,
  n_live_tup AS estimated_rows,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  pg_size_pretty(pg_relation_size(relid)) AS table_size,
  pg_size_pretty(pg_indexes_size(relid)) AS indexes_size
FROM pg_stat_user_tables
WHERE relname = 'bookmarks';

-- 7.2 检查表是否需要 VACUUM/ANALYZE
SELECT
  relname,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze,
  n_dead_tup AS dead_rows,
  n_live_tup AS live_rows
FROM pg_stat_user_tables
WHERE relname = 'bookmarks';

-- ============================================================================
-- STEP 8: 连接和锁检查
-- ============================================================================

-- 8.1 当前活跃连接数
SELECT
  count(*) AS total_connections,
  count(*) FILTER (WHERE state = 'active') AS active,
  count(*) FILTER (WHERE state = 'idle') AS idle,
  count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction
FROM pg_stat_activity
WHERE datname = current_database();

-- 8.2 长时间运行的查询
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
  AND state != 'idle'
ORDER BY duration DESC;

-- ============================================================================
-- STEP 9: 其他相关表索引检查
-- ============================================================================

-- folders 表索引
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'folders';

-- flashcards 表索引（Brain-Sync 相关）
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'flashcards';

-- review_sessions 表索引
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'review_sessions';

-- ============================================================================
-- STEP 10: 推荐创建的索引（如果缺失）
-- ============================================================================

-- 检查是否存在首页查询优化索引
SELECT EXISTS (
  SELECT 1 FROM pg_indexes
  WHERE tablename = 'bookmarks'
  AND indexdef LIKE '%user_id%'
  AND indexdef LIKE '%is_in_trash%'
  AND indexdef LIKE '%deleted_at%'
  AND indexdef LIKE '%created_at%'
) AS has_home_query_index;

-- 如果上面返回 false，执行以下语句创建索引：
/*
-- 首页默认查询优化索引（部分索引，仅包含活跃书签）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookmarks_home_query_v2
ON bookmarks(user_id, created_at DESC)
WHERE deleted_at IS NULL AND is_in_trash = false;

-- 平台筛选优化索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookmarks_platform_query_v2
ON bookmarks(user_id, platform, created_at DESC)
WHERE deleted_at IS NULL AND is_in_trash = false;

-- 垃圾箱查询优化索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookmarks_trash_query
ON bookmarks(user_id, created_at DESC)
WHERE deleted_at IS NULL AND is_in_trash = true;

-- folder_id 外键索引（JOIN 优化）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookmarks_folder_id_v2
ON bookmarks(folder_id)
WHERE folder_id IS NOT NULL AND deleted_at IS NULL;
*/

-- ============================================================================
-- STEP 11: Brain-Sync 相关查询性能（如果使用该功能）
-- ============================================================================

-- flashcards 查询性能
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT f.*, b.title AS bookmark_title, b.url AS bookmark_url
FROM flashcards f
JOIN bookmarks b ON f.bookmark_id = b.id
WHERE f.user_id = (SELECT id FROM auth.users WHERE email = 'warclover@163.com' LIMIT 1)
  AND f.status IN ('pending', 'learning')
  AND (f.next_review_at IS NULL OR f.next_review_at <= NOW())
ORDER BY f.next_review_at ASC NULLS FIRST
LIMIT 10;

-- ============================================================================
-- 诊断结果解读指南
-- ============================================================================
/*
关键指标解读：

1. EXPLAIN ANALYZE 输出中的 "actual time"：
   - < 10ms: 优秀
   - 10-100ms: 良好
   - 100-500ms: 需要优化
   - > 500ms: 严重问题

2. 扫描类型：
   - "Index Scan" / "Index Only Scan": 正常
   - "Bitmap Index Scan": 可接受
   - "Seq Scan" (在大表上): 需要添加索引

3. Buffers 信息：
   - "shared hit": 缓存命中（好）
   - "shared read": 磁盘读取（多则需优化）

4. RLS 策略开销：
   - 如果禁用 RLS 后查询显著变快，说明 RLS 策略需要优化
   - 检查策略中是否有子查询或复杂条件

5. 连接数：
   - 如果 active 连接接近 max_connections，可能有连接池问题
   - idle in transaction 过多说明有未提交的事务
*/

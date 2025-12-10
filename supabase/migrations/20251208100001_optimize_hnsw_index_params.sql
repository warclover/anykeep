-- ===========================================
-- 智能分类 V4.0 - HNSW 索引参数优化
-- ===========================================
-- 版本: 4.0.0
-- 日期: 2025-12-08
-- 说明: 优化 HNSW 索引参数，提高召回率和查询精度
--
-- 背景:
-- - 现有索引使用默认参数 (m=16, ef_construction=64)
-- - V4.0 目标: P95 响应 < 500ms, 向量检索 P95 < 100ms
--
-- 优化策略:
-- - 保持 m=16 (连接数适中，平衡内存和精度)
-- - 增加 ef_construction 到 100 (提高构建精度，一次性成本)
-- - 添加运行时 ef_search 配置函数 (查询时动态调整)

-- -------------------------------------------
-- 1. 运行时 ef_search 配置辅助函数
-- -------------------------------------------
-- 说明: ef_search 需要在会话级别设置，无法在索引中固定
-- 推荐值:
--   - 快速查询: ef_search = 40 (默认)
--   - 高精度查询: ef_search = 100-200
--   - 批量导入后首次查询: ef_search = 200

CREATE OR REPLACE FUNCTION set_hnsw_ef_search(ef_value int DEFAULT 100)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 设置当前会话的 hnsw.ef_search 参数
  EXECUTE format('SET LOCAL hnsw.ef_search = %s', ef_value);
END;
$$;

COMMENT ON FUNCTION set_hnsw_ef_search IS
'设置 HNSW 查询时的搜索深度。值越大精度越高但越慢。推荐: 快速=40, 标准=100, 高精度=200';

GRANT EXECUTE ON FUNCTION set_hnsw_ef_search TO authenticated;

-- -------------------------------------------
-- 2. 添加索引性能监控视图
-- -------------------------------------------

CREATE OR REPLACE VIEW vector_index_stats AS
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  idx_scan as total_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE indexname LIKE '%embedding%' OR indexname LIKE '%hnsw%'
ORDER BY pg_relation_size(indexrelid) DESC;

COMMENT ON VIEW vector_index_stats IS
'向量索引性能统计视图，用于监控 HNSW 索引使用情况';

GRANT SELECT ON vector_index_stats TO authenticated;

-- -------------------------------------------
-- 3. 重建 HNSW 索引 (可选，生产环境需评估)
-- -------------------------------------------
-- 注意: 重建索引会锁表，建议在低峰期执行
-- 如需重建，取消下面注释并执行

-- CONCURRENTLY 方式重建索引（不阻塞读写，但更慢）
-- DROP INDEX CONCURRENTLY IF EXISTS idx_bookmarks_embedding_hnsw;
-- CREATE INDEX CONCURRENTLY idx_bookmarks_embedding_hnsw_v2
-- ON public.bookmarks
-- USING hnsw (embedding vector_cosine_ops)
-- WITH (m = 16, ef_construction = 100);

-- DROP INDEX CONCURRENTLY IF EXISTS idx_folder_profiles_embedding_hnsw;
-- CREATE INDEX CONCURRENTLY idx_folder_profiles_embedding_hnsw_v2
-- ON public.folder_profiles
-- USING hnsw (profile_embedding vector_cosine_ops)
-- WITH (m = 16, ef_construction = 100);

-- -------------------------------------------
-- 4. 添加查询性能追踪注释
-- -------------------------------------------

COMMENT ON INDEX idx_bookmarks_embedding_hnsw IS
'HNSW 向量索引 (V4.0)。参数: m=16, ef_construction=64。查询时使用 set_hnsw_ef_search() 调整精度。';

-- 完成

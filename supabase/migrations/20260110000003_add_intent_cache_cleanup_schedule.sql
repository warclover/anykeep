-- ============================================
-- AI 意图映射增强 - 缓存清理调度
--
-- 版本: 1.0.0
-- 创建日期: 2026-01-10
-- 说明: 添加定时任务清理过期的意图分类缓存
-- 关联 Issue: Code Review #2
-- ============================================

-- 注意: pg_cron 扩展需要在 Supabase Dashboard 中启用
-- 或者使用 Supabase Edge Function 定时触发

-- 方案 A: 使用 pg_cron (如果已启用)
-- ============================================

DO $$
BEGIN
  -- 检查 pg_cron 扩展是否已启用
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- 删除已存在的任务（如果有）
    PERFORM cron.unschedule('cleanup-intent-cache');

    -- 创建每小时执行的清理任务
    PERFORM cron.schedule(
      'cleanup-intent-cache',
      '0 * * * *',  -- 每小时整点执行
      $$SELECT cleanup_expired_intent_cache()$$
    );

    RAISE NOTICE 'pg_cron job scheduled: cleanup-intent-cache (hourly)';
  ELSE
    RAISE NOTICE 'pg_cron extension not enabled. Please use Edge Function for scheduled cleanup.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Failed to schedule pg_cron job: %. Please use Edge Function instead.', SQLERRM;
END $$;

-- 方案 B: 创建一个可被 Edge Function 调用的清理函数
-- ============================================

-- 增强版清理函数，返回更多统计信息
CREATE OR REPLACE FUNCTION cleanup_intent_cache_with_stats()
RETURNS JSONB AS $$
DECLARE
  deleted_count INTEGER;
  remaining_count INTEGER;
  oldest_entry TIMESTAMPTZ;
  newest_entry TIMESTAMPTZ;
BEGIN
  -- 删除过期缓存
  DELETE FROM ai_intent_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- 获取统计信息
  SELECT COUNT(*), MIN(created_at), MAX(created_at)
  INTO remaining_count, oldest_entry, newest_entry
  FROM ai_intent_cache
  WHERE expires_at > NOW();

  RETURN jsonb_build_object(
    'deleted_count', deleted_count,
    'remaining_count', remaining_count,
    'oldest_entry', oldest_entry,
    'newest_entry', newest_entry,
    'cleanup_time', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 添加注释
COMMENT ON FUNCTION cleanup_intent_cache_with_stats IS '清理过期意图缓存并返回统计信息，供 Edge Function 调用';

-- 创建索引优化清理性能（如果不存在）
CREATE INDEX IF NOT EXISTS idx_ai_intent_cache_expires_cleanup
  ON ai_intent_cache (expires_at)
  WHERE expires_at < NOW();

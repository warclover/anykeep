-- ============================================
-- Classification v5.0 定时任务配置
-- 创建日期: 2026-01-18
-- 说明: 配置 Supabase Cron 定时任务
-- ============================================

-- 启用 pg_cron 扩展（如果尚未启用）
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================
-- 定时任务 1: 文件夹画像后台更新
-- 频率: 每天凌晨 3 点
-- 功能: 调用 update-folder-profiles Edge Function
-- ============================================

SELECT cron.schedule(
  'classification-v5-update-folder-profiles',
  '0 3 * * *',  -- 每天凌晨 3 点
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/update-folder-profiles',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 添加任务注释
COMMENT ON EXTENSION pg_cron IS 'Classification v5.0 - 文件夹画像后台更新定时任务';

-- ============================================
-- 定时任务 2: T1 队列后台处理
-- 频率: 每 5 分钟
-- 功能: 调用 process-t1-corrections Edge Function
-- ============================================

SELECT cron.schedule(
  'classification-v5-process-t1-corrections',
  '*/5 * * * *',  -- 每 5 分钟
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/process-t1-corrections',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================
-- 配置说明
-- ============================================

-- 注意事项：
-- 1. 需要在 Supabase Dashboard 中配置以下环境变量：
--    - app.settings.supabase_url: Supabase 项目 URL
--    - app.settings.supabase_anon_key: Supabase 匿名密钥
--
-- 2. 查看定时任务状态：
--    SELECT * FROM cron.job;
--
-- 3. 查看任务执行历史：
--    SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
--
-- 4. 删除定时任务（如需要）：
--    SELECT cron.unschedule('classification-v5-update-folder-profiles');
--    SELECT cron.unschedule('classification-v5-process-t1-corrections');
--
-- 5. 手动触发任务（测试用）：
--    SELECT cron.schedule('test-task', '* * * * *', $$ SELECT 1 $$);

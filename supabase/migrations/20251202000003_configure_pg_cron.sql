/**
 * 配置 pg_cron 定时任务
 *
 * 功能：
 * 1. 启用 pg_cron 和 http 扩展
 * 2. 创建包装函数调用 Edge Functions
 * 3. 配置定时任务：
 *    - cleanup-trash: 每月1日 02:00 (清理超过30天的垃圾箱项目)
 *    - validate-all-links: 每月1日 03:00 (验证所有链接有效性)
 */

-- ========== 1. 启用扩展 ==========

-- 启用 pg_cron 扩展（如果尚未启用）
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 启用 http 扩展（用于调用 Edge Functions）
CREATE EXTENSION IF NOT EXISTS http;

-- ========== 2. 创建包装函数 ==========

/**
 * 调用 cleanup-trash Edge Function
 * 返回执行结果
 */
CREATE OR REPLACE FUNCTION invoke_cleanup_trash()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  function_url text;
  service_role_key text;
  response http_response;
BEGIN
  -- 获取 Edge Function URL（需要在环境变量中配置）
  -- 格式: https://<project-ref>.supabase.co/functions/v1/cleanup-trash
  SELECT current_setting('app.settings.supabase_url', true) INTO function_url;
  function_url := function_url || '/functions/v1/cleanup-trash';

  -- 获取服务角色密钥
  SELECT current_setting('app.settings.supabase_service_role_key', true) INTO service_role_key;

  -- 发送 POST 请求调用 Edge Function
  SELECT * INTO response FROM http((
    'POST',
    function_url,
    ARRAY[
      http_header('Authorization', 'Bearer ' || service_role_key),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    '{}'
  )::http_request);

  -- 记录日志
  RAISE NOTICE 'cleanup-trash executed: status=%, content=%', response.status, response.content;

  -- 返回响应内容
  RETURN response.content::jsonb;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'cleanup-trash failed: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

/**
 * 调用 validate-all-links Edge Function
 * 返回执行结果
 */
CREATE OR REPLACE FUNCTION invoke_validate_all_links()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  function_url text;
  service_role_key text;
  response http_response;
BEGIN
  -- 获取 Edge Function URL
  SELECT current_setting('app.settings.supabase_url', true) INTO function_url;
  function_url := function_url || '/functions/v1/validate-all-links';

  -- 获取服务角色密钥
  SELECT current_setting('app.settings.supabase_service_role_key', true) INTO service_role_key;

  -- 发送 POST 请求调用 Edge Function
  SELECT * INTO response FROM http((
    'POST',
    function_url,
    ARRAY[
      http_header('Authorization', 'Bearer ' || service_role_key),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    '{}'
  )::http_request);

  -- 记录日志
  RAISE NOTICE 'validate-all-links executed: status=%, content=%', response.status, response.content;

  -- 返回响应内容
  RETURN response.content::jsonb;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'validate-all-links failed: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- ========== 3. 配置 pg_cron 定时任务 ==========

/**
 * 定时任务 1: cleanup-trash
 *
 * 执行时间: 每月1日 02:00 (UTC)
 * Cron 表达式: 0 2 1 * *
 * 说明: 清理超过30天的垃圾箱项目
 */
SELECT cron.schedule(
  'cleanup-trash',           -- 任务名称
  '0 2 1 * *',              -- Cron 表达式（每月1日 02:00 UTC）
  'SELECT invoke_cleanup_trash();'  -- 执行的 SQL
);

/**
 * 定时任务 2: validate-all-links
 *
 * 执行时间: 每月1日 03:00 (UTC)
 * Cron 表达式: 0 3 1 * *
 * 说明: 验证所有链接有效性
 */
SELECT cron.schedule(
  'validate-all-links',      -- 任务名称
  '0 3 1 * *',              -- Cron 表达式（每月1日 03:00 UTC）
  'SELECT invoke_validate_all_links();'  -- 执行的 SQL
);

-- ========== 4. 查看已配置的定时任务 ==========

-- 取消注释以查看当前所有的 cron 任务
-- SELECT * FROM cron.job;

-- ========== 5. 添加注释 ==========

COMMENT ON FUNCTION invoke_cleanup_trash() IS '包装函数：调用 cleanup-trash Edge Function，清理超过30天的垃圾箱项目';
COMMENT ON FUNCTION invoke_validate_all_links() IS '包装函数：调用 validate-all-links Edge Function，验证所有链接有效性';

-- ========== 6. 手动执行测试（可选）==========

-- 取消注释以手动测试
-- SELECT invoke_cleanup_trash();
-- SELECT invoke_validate_all_links();

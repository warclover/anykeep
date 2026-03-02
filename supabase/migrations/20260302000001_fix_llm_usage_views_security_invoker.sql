-- Fix: llm_usage_monthly / llm_usage_daily 使用 SECURITY INVOKER
-- 问题: 视图默认 SECURITY DEFINER 会以视图创建者权限执行，绕过底层表 RLS，存在越权风险
-- 解决: 设置为 security_invoker = true，查询时以调用者身份执行，底层 llm_usage_log 的 RLS 生效
-- 参考: Supabase 安全提醒、PostgreSQL 15+ security_invoker 视图

ALTER VIEW public.llm_usage_monthly SET (security_invoker = true);
ALTER VIEW public.llm_usage_daily SET (security_invoker = true);

COMMENT ON VIEW public.llm_usage_monthly IS 'Monthly aggregated LLM usage per user (security_invoker: RLS enforced)';
COMMENT ON VIEW public.llm_usage_daily IS 'Daily aggregated LLM usage per user (security_invoker: RLS enforced)';

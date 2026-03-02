-- Enable RLS on edge_function_rate_limits (Supabase 安全提醒)
-- 该表仅由 Edge Function（workflow-scheduler，service role）与 SECURITY DEFINER 清理函数访问，不向 anon/authenticated 开放

ALTER TABLE public.edge_function_rate_limits ENABLE ROW LEVEL SECURITY;

-- 不创建任何 FOR anon/authenticated 的 policy；service role 与 DEFINER 函数自动绕过 RLS

COMMENT ON TABLE public.edge_function_rate_limits IS 'Edge Function 速率限制记录表；仅 service role / DEFINER 函数访问，RLS 已开启';

-- Enable RLS on payment_events (Supabase 安全提醒)
-- 该表仅由服务端 Webhook 使用，不向 anon/authenticated 开放；Webhook 使用 service role 绕过 RLS

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- 不创建任何 FOR anon/authenticated 的 policy，确保前端与匿名无法访问
-- Service role（Webhook 使用的 createServiceClient）自动绕过 RLS，读写不受影响

COMMENT ON TABLE public.payment_events IS 'Webhook 事件表（幂等性）；仅服务端 service role 访问，RLS 已开启';

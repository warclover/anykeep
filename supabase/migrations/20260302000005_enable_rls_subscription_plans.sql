-- Enable RLS on subscription_plans (Supabase 安全提醒)
-- 表为全局订阅计划配置（Free/Pro/Pro+/LTD），已登录用户仅需只读（如 join user_subscriptions 展示套餐信息）；写操作仅通过 service role

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- 已登录用户可读全部计划；不授予 INSERT/UPDATE/DELETE
CREATE POLICY "Authenticated can read subscription plans"
  ON public.subscription_plans
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE public.subscription_plans IS '订阅计划配置表；RLS 仅开放 SELECT 给 authenticated';

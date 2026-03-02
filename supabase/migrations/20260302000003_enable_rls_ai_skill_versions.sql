-- Enable RLS on ai_skill_versions (Supabase 安全提醒)
-- 表为全局 Skill 版本配置，仅需只读暴露给已登录用户；写操作仅通过 service role（迁移/管理）

ALTER TABLE public.ai_skill_versions ENABLE ROW LEVEL SECURITY;

-- 已登录用户可读全部版本配置；不授予 INSERT/UPDATE/DELETE，仅 service role 可写
CREATE POLICY "Authenticated can read skill versions"
  ON public.ai_skill_versions
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE public.ai_skill_versions IS 'Skill 版本配置表，管理 Skill 的版本和配置；RLS 仅开放 SELECT 给 authenticated';

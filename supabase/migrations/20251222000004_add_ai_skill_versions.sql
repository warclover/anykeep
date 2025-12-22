-- AI Skill 版本配置表
-- 用于管理 Skill 版本和配置

CREATE TABLE IF NOT EXISTS public.ai_skill_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id TEXT NOT NULL,
  version TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (skill_id, version)
);

CREATE INDEX IF NOT EXISTS idx_skill_versions_skill ON ai_skill_versions(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_versions_active ON ai_skill_versions(is_active);

-- 此表为系统配置表，不启用 RLS（仅后端访问）

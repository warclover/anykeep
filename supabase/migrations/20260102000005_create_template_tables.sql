-- Knowledge Studio P3: Custom Template Tables
-- 自定义模板表
-- 2026-01-02

-- ============================================================================
-- 自定义模板表
-- ============================================================================

CREATE TABLE IF NOT EXISTS ks_custom_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT,
  base_blueprint TEXT, -- 基于的蓝图类型
  variables JSONB NOT NULL DEFAULT '[]', -- TemplateVariable[]
  prompt_sections JSONB NOT NULL DEFAULT '[]', -- TemplatePromptSection[]
  output_format TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'shared', 'public')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  version INTEGER NOT NULL DEFAULT 1,
  usage_count INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_ks_custom_templates_user_id ON ks_custom_templates(user_id);
CREATE INDEX idx_ks_custom_templates_status ON ks_custom_templates(status);
CREATE INDEX idx_ks_custom_templates_visibility ON ks_custom_templates(visibility);
CREATE INDEX idx_ks_custom_templates_base_blueprint ON ks_custom_templates(base_blueprint);
CREATE INDEX idx_ks_custom_templates_tags ON ks_custom_templates USING GIN(tags);

-- RLS
ALTER TABLE ks_custom_templates ENABLE ROW LEVEL SECURITY;

-- 用户可以查看自己的模板和公开模板
CREATE POLICY "Users can view own and public templates"
  ON ks_custom_templates FOR SELECT
  USING (
    auth.uid() = user_id
    OR visibility = 'public'
  );

-- 用户可以创建自己的模板
CREATE POLICY "Users can create own templates"
  ON ks_custom_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户可以更新自己的模板
CREATE POLICY "Users can update own templates"
  ON ks_custom_templates FOR UPDATE
  USING (auth.uid() = user_id);

-- 用户可以删除自己的模板
CREATE POLICY "Users can delete own templates"
  ON ks_custom_templates FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 模板版本历史表
-- ============================================================================

CREATE TABLE IF NOT EXISTS ks_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES ks_custom_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  changelog TEXT NOT NULL DEFAULT '',
  variables JSONB NOT NULL DEFAULT '[]',
  prompt_sections JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  UNIQUE(template_id, version)
);

-- 索引
CREATE INDEX idx_ks_template_versions_template_id ON ks_template_versions(template_id);

-- RLS
ALTER TABLE ks_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view versions of accessible templates"
  ON ks_template_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ks_custom_templates t
      WHERE t.id = ks_template_versions.template_id
      AND (t.user_id = auth.uid() OR t.visibility = 'public')
    )
  );

CREATE POLICY "Users can create versions of own templates"
  ON ks_template_versions FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM ks_custom_templates t
      WHERE t.id = ks_template_versions.template_id
      AND t.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 模板使用记录表
-- ============================================================================

CREATE TABLE IF NOT EXISTS ks_template_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES ks_custom_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  variable_values JSONB NOT NULL DEFAULT '{}',
  report_id UUID, -- 关联的报告
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_ks_template_usages_template_id ON ks_template_usages(template_id);
CREATE INDEX idx_ks_template_usages_user_id ON ks_template_usages(user_id);
CREATE INDEX idx_ks_template_usages_created_at ON ks_template_usages(created_at);

-- RLS
ALTER TABLE ks_template_usages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own template usages"
  ON ks_template_usages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can record template usages"
  ON ks_template_usages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own template usages"
  ON ks_template_usages FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 模板分享表
-- ============================================================================

CREATE TABLE IF NOT EXISTS ks_template_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES ks_custom_templates(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'use', 'edit')),
  shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(template_id, shared_with_user_id)
);

-- 索引
CREATE INDEX idx_ks_template_shares_template_id ON ks_template_shares(template_id);
CREATE INDEX idx_ks_template_shares_shared_with ON ks_template_shares(shared_with_user_id);

-- RLS
ALTER TABLE ks_template_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shares they created or received"
  ON ks_template_shares FOR SELECT
  USING (
    auth.uid() = shared_by
    OR auth.uid() = shared_with_user_id
  );

CREATE POLICY "Template owners can create shares"
  ON ks_template_shares FOR INSERT
  WITH CHECK (
    auth.uid() = shared_by
    AND EXISTS (
      SELECT 1 FROM ks_custom_templates t
      WHERE t.id = ks_template_shares.template_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Template owners can delete shares"
  ON ks_template_shares FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM ks_custom_templates t
      WHERE t.id = ks_template_shares.template_id
      AND t.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 触发器：更新使用次数
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_template_usage_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE ks_custom_templates
  SET usage_count = usage_count + 1,
      updated_at = now()
  WHERE id = NEW.template_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_increment_template_usage
  AFTER INSERT ON ks_template_usages
  FOR EACH ROW
  EXECUTE FUNCTION increment_template_usage_count();

-- ============================================================================
-- 触发器：自动创建版本历史
-- ============================================================================

CREATE OR REPLACE FUNCTION create_template_version_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 只在变量或 prompt 部分变更时创建版本
  IF OLD.variables IS DISTINCT FROM NEW.variables
     OR OLD.prompt_sections IS DISTINCT FROM NEW.prompt_sections THEN
    INSERT INTO ks_template_versions (
      template_id,
      version,
      changelog,
      variables,
      prompt_sections,
      created_by
    ) VALUES (
      NEW.id,
      NEW.version,
      '自动保存版本',
      NEW.variables,
      NEW.prompt_sections,
      NEW.user_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_create_template_version
  AFTER UPDATE ON ks_custom_templates
  FOR EACH ROW
  WHEN (OLD.version IS DISTINCT FROM NEW.version)
  EXECUTE FUNCTION create_template_version_on_update();

-- ============================================================================
-- RPC：搜索公开模板
-- ============================================================================

CREATE OR REPLACE FUNCTION search_public_templates(
  p_query TEXT,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  icon TEXT,
  base_blueprint TEXT,
  usage_count INTEGER,
  tags TEXT[],
  user_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.description,
    t.icon,
    t.base_blueprint,
    t.usage_count,
    t.tags,
    t.user_id,
    t.created_at
  FROM ks_custom_templates t
  WHERE t.visibility = 'public'
    AND t.status = 'active'
    AND (
      t.name ILIKE '%' || p_query || '%'
      OR t.description ILIKE '%' || p_query || '%'
      OR p_query = ANY(t.tags)
    )
  ORDER BY t.usage_count DESC, t.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ============================================================================
-- RPC：克隆模板
-- ============================================================================

CREATE OR REPLACE FUNCTION clone_template(
  p_template_id UUID,
  p_new_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_source ks_custom_templates;
  v_new_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- 获取源模板
  SELECT * INTO v_source
  FROM ks_custom_templates
  WHERE id = p_template_id
    AND (user_id = v_user_id OR visibility = 'public');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found or not accessible';
  END IF;

  -- 创建副本
  INSERT INTO ks_custom_templates (
    user_id,
    name,
    description,
    icon,
    base_blueprint,
    variables,
    prompt_sections,
    output_format,
    visibility,
    status,
    tags
  ) VALUES (
    v_user_id,
    COALESCE(p_new_name, v_source.name || ' (副本)'),
    v_source.description,
    v_source.icon,
    v_source.base_blueprint,
    v_source.variables,
    v_source.prompt_sections,
    v_source.output_format,
    'private',
    'draft',
    v_source.tags
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;


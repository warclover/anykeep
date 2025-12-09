-- V4.2 AI Folder Settings Migration
-- Add AI folder management settings to profiles table
-- Phase 5.1.1: User preferences for AI folder evolution
-- @version 1.0.0
-- @since 2025-12-09

-- 1. Check if settings column exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'settings'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN settings JSONB DEFAULT '{}'::JSONB;
  END IF;
END $$;

-- 2. Create function to get AI folder settings with defaults
CREATE OR REPLACE FUNCTION public.get_ai_folder_settings(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings JSONB;
  v_defaults JSONB := '{
    "autonomy_level": 2,
    "enable_auto_create": true,
    "enable_auto_split": false,
    "enable_auto_merge": false,
    "enable_auto_rename": false,
    "create_notification": true,
    "report_interval": "monthly",
    "daily_create_limit": 6
  }'::JSONB;
BEGIN
  SELECT COALESCE(settings->'ai_folder_settings', '{}'::JSONB)
  INTO v_settings
  FROM profiles
  WHERE id = p_user_id;

  IF v_settings IS NULL THEN
    v_settings := '{}'::JSONB;
  END IF;

  -- Merge with defaults (user settings override defaults)
  RETURN v_defaults || v_settings;
END;
$$;

-- 3. Create function to update AI folder settings
CREATE OR REPLACE FUNCTION public.update_ai_folder_settings(
  p_user_id UUID,
  p_settings JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_settings JSONB;
  v_new_settings JSONB;
BEGIN
  -- Get current settings
  SELECT COALESCE(settings, '{}'::JSONB)
  INTO v_current_settings
  FROM profiles
  WHERE id = p_user_id;

  -- Merge new AI folder settings
  v_new_settings := v_current_settings || jsonb_build_object(
    'ai_folder_settings',
    COALESCE(v_current_settings->'ai_folder_settings', '{}'::JSONB) || p_settings
  );

  -- Update profile
  UPDATE profiles
  SET settings = v_new_settings,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Return the updated AI folder settings
  RETURN get_ai_folder_settings(p_user_id);
END;
$$;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION public.get_ai_folder_settings TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_ai_folder_settings TO authenticated;

-- 5. Add comments
COMMENT ON FUNCTION public.get_ai_folder_settings IS 'Get user AI folder settings with defaults applied';
COMMENT ON FUNCTION public.update_ai_folder_settings IS 'Update user AI folder settings';

-- 6. Create evolution_reports table for monthly reports
CREATE TABLE IF NOT EXISTS public.evolution_reports (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Report period
  report_month VARCHAR(7) NOT NULL, -- 'YYYY-MM' format

  -- Classification stats
  total_classified INT NOT NULL DEFAULT 0,
  auto_classified INT NOT NULL DEFAULT 0,
  manual_adjusted INT NOT NULL DEFAULT 0,

  -- Folder changes
  folders_created INT NOT NULL DEFAULT 0,
  folders_split INT NOT NULL DEFAULT 0,
  folders_merged INT NOT NULL DEFAULT 0,
  folders_renamed INT NOT NULL DEFAULT 0,

  -- Quality metrics
  avg_confidence FLOAT,
  acceptance_rate FLOAT,
  health_score INT CHECK (health_score >= 0 AND health_score <= 100),

  -- Suggestions
  pending_suggestions INT NOT NULL DEFAULT 0,
  suggestions_data JSONB DEFAULT '[]'::JSONB,

  -- Metadata
  generated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  viewed_at TIMESTAMPTZ,

  -- Unique constraint: one report per user per month
  CONSTRAINT unique_user_month UNIQUE (user_id, report_month)
);

-- 7. Create indexes for evolution_reports
CREATE INDEX idx_evolution_reports_user_id
  ON public.evolution_reports(user_id);

CREATE INDEX idx_evolution_reports_month
  ON public.evolution_reports(report_month DESC);

-- 8. RLS for evolution_reports
ALTER TABLE public.evolution_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports"
  ON public.evolution_reports
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert reports"
  ON public.evolution_reports
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own reports"
  ON public.evolution_reports
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 9. Add comments
COMMENT ON TABLE public.evolution_reports IS 'V4.2 Monthly AI folder evolution reports';

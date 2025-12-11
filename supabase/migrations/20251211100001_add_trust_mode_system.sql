-- V4.2 Trust Mode System Migration
-- Add core tables for trust mode, pending confirmations, and source profiles
-- Phase 0: Sprint 0.1 - Database Foundation
-- @version 1.0.0
-- @since 2025-12-11

-- ============================================================================
-- 1. User Trust Mode Table (托管模式配置表)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_trust_mode (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 当前托管模式: 'full_auto' | 'semi_auto' | 'manual'
  trust_mode VARCHAR(20) NOT NULL DEFAULT 'full_auto'
    CHECK (trust_mode IN ('full_auto', 'semi_auto', 'manual')),

  -- 细粒度开关覆盖（覆盖模式默认值）
  overrides JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- 模式切换历史
  -- 格式: [{ from: string, to: string, timestamp: string, reason?: string }]
  mode_history JSONB NOT NULL DEFAULT '[]'::JSONB,

  -- 统计信息
  auto_decisions_count INT NOT NULL DEFAULT 0,      -- AI 自动决策次数
  user_corrections_count INT NOT NULL DEFAULT 0,    -- 用户纠正次数
  pending_confirmations_count INT NOT NULL DEFAULT 0, -- 待确认数量

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 每个用户只能有一条记录
  CONSTRAINT unique_user_trust_mode UNIQUE (user_id)
);

-- Indexes for user_trust_mode
CREATE INDEX IF NOT EXISTS idx_user_trust_mode_user_id
  ON public.user_trust_mode(user_id);

CREATE INDEX IF NOT EXISTS idx_user_trust_mode_mode
  ON public.user_trust_mode(trust_mode);

-- RLS for user_trust_mode
ALTER TABLE public.user_trust_mode ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own trust mode" ON public.user_trust_mode;
CREATE POLICY "Users can view own trust mode"
  ON public.user_trust_mode
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own trust mode" ON public.user_trust_mode;
CREATE POLICY "Users can insert own trust mode"
  ON public.user_trust_mode
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own trust mode" ON public.user_trust_mode;
CREATE POLICY "Users can update own trust mode"
  ON public.user_trust_mode
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Comment
COMMENT ON TABLE public.user_trust_mode IS 'V4.2 用户托管模式配置，控制 AI 自动化程度';

-- ============================================================================
-- 2. Pending Confirmations Table (待确认队列表)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pending_confirmations (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 确认类型
  confirmation_type VARCHAR(50) NOT NULL
    CHECK (confirmation_type IN (
      'classification',
      'folder_create',
      'folder_merge',
      'folder_split',
      'folder_rename'
    )),

  -- 关联对象 ID
  bookmark_id BIGINT REFERENCES public.bookmarks(id) ON DELETE CASCADE,
  folder_id BIGINT REFERENCES public.folders(id) ON DELETE SET NULL,

  -- AI 建议（JSON 格式，结构取决于 confirmation_type）
  -- classification: { folderId, folderName, confidence, reason, alternatives }
  -- folder_create: { suggestedName, reason, bookmarkIds, estimatedCount }
  -- folder_merge: { targetFolderId, sourceFolderIds, reason, similarityScore }
  -- folder_split: { sourceFolderId, suggestedSubFolders, reason }
  -- folder_rename: { folderId, currentName, suggestedName, reason }
  suggestion JSONB NOT NULL,

  -- 状态: 'pending' | 'confirmed' | 'rejected' | 'modified' | 'expired'
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'rejected', 'modified', 'expired')),

  -- 用户响应（JSON 格式）
  -- { choice: {...}, timestamp: string }
  user_choice JSONB,

  -- 过期时间（默认 7 天后）
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Indexes for pending_confirmations
CREATE INDEX IF NOT EXISTS idx_pending_confirmations_user_status
  ON public.pending_confirmations(user_id, status);

CREATE INDEX IF NOT EXISTS idx_pending_confirmations_expires
  ON public.pending_confirmations(expires_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_pending_confirmations_type
  ON public.pending_confirmations(confirmation_type);

CREATE INDEX IF NOT EXISTS idx_pending_confirmations_bookmark
  ON public.pending_confirmations(bookmark_id)
  WHERE bookmark_id IS NOT NULL;

-- RLS for pending_confirmations
ALTER TABLE public.pending_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own confirmations" ON public.pending_confirmations;
CREATE POLICY "Users can view own confirmations"
  ON public.pending_confirmations
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service can insert confirmations" ON public.pending_confirmations;
CREATE POLICY "Service can insert confirmations"
  ON public.pending_confirmations
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own confirmations" ON public.pending_confirmations;
CREATE POLICY "Users can update own confirmations"
  ON public.pending_confirmations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own confirmations" ON public.pending_confirmations;
CREATE POLICY "Users can delete own confirmations"
  ON public.pending_confirmations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Comment
COMMENT ON TABLE public.pending_confirmations IS 'V4.2 半托管模式待确认队列，存储 AI 建议和用户响应';

-- ============================================================================
-- 3. Source Profiles Table (来源画像表)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.source_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 来源标识（唯一）
  -- 格式: wechat:xxx / bilibili:xxx / website:domain.com
  source_id VARCHAR(255) NOT NULL,

  -- 来源名称（公众号名 / 网站名）
  source_name VARCHAR(255),

  -- 来源类型
  source_type VARCHAR(50) NOT NULL DEFAULT 'website'
    CHECK (source_type IN (
      'wechat_mp',
      'bilibili',
      'xiaohongshu',
      'zhihu',
      'weibo',
      'website',
      'rss',
      'other'
    )),

  -- 关联领域标签
  domains TEXT[] NOT NULL DEFAULT '{}',

  -- 可信度分数 (0-100)
  trust_score INT NOT NULL DEFAULT 50
    CHECK (trust_score >= 0 AND trust_score <= 100),

  -- 主要内容类型
  content_type VARCHAR(50) DEFAULT 'unknown'
    CHECK (content_type IN (
      'article',
      'news',
      'tutorial',
      'opinion',
      'video',
      'podcast',
      'tool',
      'reference',
      'unknown'
    )),

  -- 高频文件夹 ID 列表（用户历史归类）
  frequent_folders INT[] NOT NULL DEFAULT '{}',

  -- 样本数量（收藏过的该来源内容数）
  sample_count INT NOT NULL DEFAULT 0,

  -- 平均置信度
  avg_confidence FLOAT,

  -- 最后活跃时间
  last_seen_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 每个用户每个来源只能有一条记录
  CONSTRAINT unique_user_source UNIQUE (user_id, source_id)
);

-- Indexes for source_profiles
CREATE INDEX IF NOT EXISTS idx_source_profiles_user_source
  ON public.source_profiles(user_id, source_id);

CREATE INDEX IF NOT EXISTS idx_source_profiles_source_type
  ON public.source_profiles(source_type);

CREATE INDEX IF NOT EXISTS idx_source_profiles_domains
  ON public.source_profiles USING GIN(domains);

CREATE INDEX IF NOT EXISTS idx_source_profiles_frequent_folders
  ON public.source_profiles USING GIN(frequent_folders);

-- RLS for source_profiles
ALTER TABLE public.source_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own source profiles" ON public.source_profiles;
CREATE POLICY "Users can view own source profiles"
  ON public.source_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service can insert source profiles" ON public.source_profiles;
CREATE POLICY "Service can insert source profiles"
  ON public.source_profiles
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own source profiles" ON public.source_profiles;
CREATE POLICY "Users can update own source profiles"
  ON public.source_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Comment
COMMENT ON TABLE public.source_profiles IS 'V4.2 来源画像，追踪公众号/网站的内容特征用于智能分类';

-- ============================================================================
-- 4. Helper Functions
-- ============================================================================

-- 4.1 获取用户托管模式（带默认值）
CREATE OR REPLACE FUNCTION public.get_user_trust_mode(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'trust_mode', COALESCE(trust_mode, 'full_auto'),
    'overrides', COALESCE(overrides, '{}'::JSONB),
    'auto_decisions_count', COALESCE(auto_decisions_count, 0),
    'user_corrections_count', COALESCE(user_corrections_count, 0),
    'pending_confirmations_count', COALESCE(pending_confirmations_count, 0)
  )
  INTO v_result
  FROM user_trust_mode
  WHERE user_id = p_user_id;

  -- 如果没有记录，返回默认值
  IF v_result IS NULL THEN
    v_result := jsonb_build_object(
      'trust_mode', 'full_auto',
      'overrides', '{}'::JSONB,
      'auto_decisions_count', 0,
      'user_corrections_count', 0,
      'pending_confirmations_count', 0
    );
  END IF;

  RETURN v_result;
END;
$$;

-- 4.2 更新用户托管模式
CREATE OR REPLACE FUNCTION public.update_user_trust_mode(
  p_user_id UUID,
  p_trust_mode VARCHAR(20),
  p_reason VARCHAR(255) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_mode VARCHAR(20);
  v_history JSONB;
  v_result JSONB;
BEGIN
  -- 获取旧模式
  SELECT trust_mode, mode_history
  INTO v_old_mode, v_history
  FROM user_trust_mode
  WHERE user_id = p_user_id;

  -- 如果不存在，创建记录
  IF v_old_mode IS NULL THEN
    INSERT INTO user_trust_mode (user_id, trust_mode, mode_history)
    VALUES (
      p_user_id,
      p_trust_mode,
      jsonb_build_array(jsonb_build_object(
        'from', NULL,
        'to', p_trust_mode,
        'timestamp', NOW(),
        'reason', p_reason
      ))
    )
    RETURNING jsonb_build_object(
      'trust_mode', trust_mode,
      'overrides', overrides,
      'changed', true
    ) INTO v_result;
  ELSE
    -- 更新现有记录
    UPDATE user_trust_mode
    SET
      trust_mode = p_trust_mode,
      mode_history = v_history || jsonb_build_array(jsonb_build_object(
        'from', v_old_mode,
        'to', p_trust_mode,
        'timestamp', NOW(),
        'reason', p_reason
      )),
      updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING jsonb_build_object(
      'trust_mode', trust_mode,
      'overrides', overrides,
      'changed', v_old_mode <> p_trust_mode
    ) INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

-- 4.3 获取待确认消息数量
CREATE OR REPLACE FUNCTION public.get_pending_confirmation_count(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM pending_confirmations
  WHERE user_id = p_user_id
    AND status = 'pending'
    AND expires_at > NOW();

  RETURN v_count;
END;
$$;

-- 4.4 自动过期待确认消息
CREATE OR REPLACE FUNCTION public.expire_pending_confirmations()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE pending_confirmations
  SET
    status = 'expired',
    resolved_at = NOW()
  WHERE status = 'pending'
    AND expires_at <= NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 4.5 获取或创建来源画像
CREATE OR REPLACE FUNCTION public.upsert_source_profile(
  p_user_id UUID,
  p_source_id VARCHAR(255),
  p_source_name VARCHAR(255) DEFAULT NULL,
  p_source_type VARCHAR(50) DEFAULT 'website',
  p_folder_id INT DEFAULT NULL,
  p_confidence FLOAT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id BIGINT;
  v_current_folders INT[];
  v_current_count INT;
  v_current_avg FLOAT;
BEGIN
  -- 尝试获取现有画像
  SELECT id, frequent_folders, sample_count, avg_confidence
  INTO v_profile_id, v_current_folders, v_current_count, v_current_avg
  FROM source_profiles
  WHERE user_id = p_user_id AND source_id = p_source_id;

  IF v_profile_id IS NULL THEN
    -- 创建新画像
    INSERT INTO source_profiles (
      user_id,
      source_id,
      source_name,
      source_type,
      frequent_folders,
      sample_count,
      avg_confidence,
      last_seen_at
    )
    VALUES (
      p_user_id,
      p_source_id,
      p_source_name,
      p_source_type,
      CASE WHEN p_folder_id IS NOT NULL THEN ARRAY[p_folder_id] ELSE '{}' END,
      1,
      p_confidence,
      NOW()
    )
    RETURNING id INTO v_profile_id;
  ELSE
    -- 更新现有画像
    UPDATE source_profiles
    SET
      source_name = COALESCE(p_source_name, source_name),
      frequent_folders = CASE
        WHEN p_folder_id IS NOT NULL AND NOT (p_folder_id = ANY(v_current_folders))
        THEN array_append(v_current_folders, p_folder_id)
        ELSE v_current_folders
      END,
      sample_count = v_current_count + 1,
      avg_confidence = CASE
        WHEN p_confidence IS NOT NULL THEN
          (COALESCE(v_current_avg, 0) * v_current_count + p_confidence) / (v_current_count + 1)
        ELSE v_current_avg
      END,
      last_seen_at = NOW(),
      updated_at = NOW()
    WHERE id = v_profile_id;
  END IF;

  RETURN v_profile_id;
END;
$$;

-- ============================================================================
-- 5. Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_user_trust_mode TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_trust_mode TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_confirmation_count TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_pending_confirmations TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_source_profile TO authenticated;

-- ============================================================================
-- 6. Update Trigger for updated_at
-- ============================================================================

-- Trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_trust_mode
DROP TRIGGER IF EXISTS update_user_trust_mode_updated_at ON public.user_trust_mode;
CREATE TRIGGER update_user_trust_mode_updated_at
  BEFORE UPDATE ON public.user_trust_mode
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for source_profiles
DROP TRIGGER IF EXISTS update_source_profiles_updated_at ON public.source_profiles;
CREATE TRIGGER update_source_profiles_updated_at
  BEFORE UPDATE ON public.source_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Migration Complete
-- ============================================================================

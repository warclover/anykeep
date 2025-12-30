-- =============================================================================
-- Migration: Add Proactive Briefing
-- Description: Phase 0 - 主动简报基础设施
-- Version: AI Secretary Evolution Phase 0
-- Date: 2025-12-30
-- =============================================================================

-- ============================================================
-- 1. 扩展 profiles 表：添加 last_visit_at 字段
-- ============================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN profiles.last_visit_at IS '用户最后访问时间，用于计算离线时长';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_profiles_last_visit
  ON profiles(last_visit_at);

-- ============================================================
-- 2. 创建 proactive_insights 表
-- ============================================================

CREATE TABLE IF NOT EXISTS proactive_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 洞察类型
  type TEXT NOT NULL CHECK (type IN (
    'topic_emergence',
    'pattern_detected',
    'recommendation',
    'knowledge_gap',
    'content_update',
    'link_health'
  )),

  -- 洞察内容
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  related_bookmark_ids BIGINT[] DEFAULT '{}',

  -- 优先级和状态
  priority INT NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,

  -- 元数据
  metadata JSONB DEFAULT '{}',

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_proactive_insights_user_unread
  ON proactive_insights(user_id, is_read, is_dismissed)
  WHERE NOT is_read AND NOT is_dismissed;

CREATE INDEX IF NOT EXISTS idx_proactive_insights_expires
  ON proactive_insights(expires_at)
  WHERE NOT is_dismissed;

CREATE INDEX IF NOT EXISTS idx_proactive_insights_priority
  ON proactive_insights(user_id, priority DESC);

-- RLS 策略
ALTER TABLE proactive_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own insights" ON proactive_insights;
CREATE POLICY "Users can view own insights"
  ON proactive_insights FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own insights" ON proactive_insights;
CREATE POLICY "Users can update own insights"
  ON proactive_insights FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert insights" ON proactive_insights;
CREATE POLICY "System can insert insights"
  ON proactive_insights FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3. RPC 函数：更新最后访问时间
-- ============================================================

CREATE OR REPLACE FUNCTION update_last_visit_time(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET last_visit_at = NOW()
  WHERE id = p_user_id;
END;
$$;

COMMENT ON FUNCTION update_last_visit_time(UUID) IS '更新用户最后访问时间';

-- ============================================================
-- 4. RPC 函数：获取离线期间的变化统计
-- ============================================================

CREATE OR REPLACE FUNCTION get_offline_changes(
  p_user_id UUID,
  p_since TIMESTAMPTZ
)
RETURNS TABLE (
  new_bookmarks_count BIGINT,
  untagged_count BIGINT,
  platforms JSONB,
  top_tags JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) FILTER (WHERE created_at >= p_since) AS new_count,
      COUNT(*) FILTER (WHERE user_tags IS NULL OR user_tags = '{}') AS untagged,
      jsonb_agg(DISTINCT platform) FILTER (WHERE created_at >= p_since) AS platforms_list
    FROM bookmarks
    WHERE user_id = p_user_id
  ),
  tag_stats AS (
    SELECT
      jsonb_agg(tag_info) AS top_tags_list
    FROM (
      SELECT jsonb_build_object('tag', tag, 'count', count) AS tag_info
      FROM bookmarks, unnest(user_tags) AS tag
      WHERE user_id = p_user_id AND created_at >= p_since
      GROUP BY tag
      ORDER BY count DESC
      LIMIT 5
    ) t
  )
  SELECT
    stats.new_count,
    stats.untagged,
    COALESCE(stats.platforms_list, '[]'::JSONB),
    COALESCE(tag_stats.top_tags_list, '[]'::JSONB)
  FROM stats, tag_stats;
END;
$$;

COMMENT ON FUNCTION get_offline_changes(UUID, TIMESTAMPTZ) IS '获取用户离线期间的变化统计';

-- ============================================================
-- 5. RPC 函数：清理过期洞察
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_expired_insights()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM proactive_insights
  WHERE expires_at < NOW()
    AND is_dismissed = FALSE;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_insights() IS '清理过期的洞察记录';

-- ============================================================
-- 6. 触发器：自动更新 updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_proactive_insights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_proactive_insights_timestamp ON proactive_insights;
CREATE TRIGGER trigger_update_proactive_insights_timestamp
  BEFORE UPDATE ON proactive_insights
  FOR EACH ROW
  EXECUTE FUNCTION update_proactive_insights_updated_at();

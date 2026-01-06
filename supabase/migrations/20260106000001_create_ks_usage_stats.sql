-- ============================================================
-- Knowledge Studio Usage Statistics Tables
-- Phase 2: 智能引导系统 - 使用统计基础设施
-- ============================================================

-- 1. 用户蓝图使用统计表
CREATE TABLE IF NOT EXISTS ks_usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  blueprint_id TEXT NOT NULL,
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  success_count INTEGER DEFAULT 0,
  cancel_count INTEGER DEFAULT 0,
  preferred_platform_style TEXT,
  preferred_length_mode TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_blueprint UNIQUE(user_id, blueprint_id)
);

-- 2. 全局蓝图热度统计表
CREATE TABLE IF NOT EXISTS ks_blueprint_popularity (
  blueprint_id TEXT PRIMARY KEY,
  total_uses INTEGER DEFAULT 0,
  weekly_uses INTEGER DEFAULT 0,
  daily_uses INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 索引优化
CREATE INDEX IF NOT EXISTS idx_ks_usage_stats_user_id
  ON ks_usage_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_ks_usage_stats_blueprint_id
  ON ks_usage_stats(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_ks_usage_stats_last_used
  ON ks_usage_stats(user_id, last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_ks_blueprint_popularity_weekly
  ON ks_blueprint_popularity(weekly_uses DESC);

-- 4. RLS 策略
ALTER TABLE ks_usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE ks_blueprint_popularity ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的使用统计
CREATE POLICY "Users can view own usage stats"
  ON ks_usage_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage stats"
  ON ks_usage_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage stats"
  ON ks_usage_stats FOR UPDATE
  USING (auth.uid() = user_id);

-- 热度统计对所有认证用户可读
CREATE POLICY "Authenticated users can view blueprint popularity"
  ON ks_blueprint_popularity FOR SELECT
  TO authenticated
  USING (true);

-- 5. 记录蓝图使用的 RPC 函数
CREATE OR REPLACE FUNCTION record_blueprint_usage(
  p_user_id UUID,
  p_blueprint_id TEXT,
  p_success BOOLEAN DEFAULT true,
  p_platform_style TEXT DEFAULT NULL,
  p_length_mode TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  -- 验证调用者身份
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: user_id mismatch';
  END IF;

  -- 更新或插入用户统计
  INSERT INTO ks_usage_stats (
    user_id,
    blueprint_id,
    use_count,
    last_used_at,
    success_count,
    cancel_count,
    preferred_platform_style,
    preferred_length_mode
  )
  VALUES (
    p_user_id,
    p_blueprint_id,
    1,
    NOW(),
    CASE WHEN p_success THEN 1 ELSE 0 END,
    CASE WHEN NOT p_success THEN 1 ELSE 0 END,
    p_platform_style,
    p_length_mode
  )
  ON CONFLICT (user_id, blueprint_id) DO UPDATE SET
    use_count = ks_usage_stats.use_count + 1,
    last_used_at = NOW(),
    success_count = ks_usage_stats.success_count + CASE WHEN p_success THEN 1 ELSE 0 END,
    cancel_count = ks_usage_stats.cancel_count + CASE WHEN NOT p_success THEN 1 ELSE 0 END,
    preferred_platform_style = COALESCE(p_platform_style, ks_usage_stats.preferred_platform_style),
    preferred_length_mode = COALESCE(p_length_mode, ks_usage_stats.preferred_length_mode),
    updated_at = NOW();

  -- 更新全局热度统计
  INSERT INTO ks_blueprint_popularity (
    blueprint_id,
    total_uses,
    weekly_uses,
    daily_uses,
    updated_at
  )
  VALUES (p_blueprint_id, 1, 1, 1, NOW())
  ON CONFLICT (blueprint_id) DO UPDATE SET
    total_uses = ks_blueprint_popularity.total_uses + 1,
    weekly_uses = ks_blueprint_popularity.weekly_uses + 1,
    daily_uses = ks_blueprint_popularity.daily_uses + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 重置每日/每周计数的函数（供定时任务调用）
CREATE OR REPLACE FUNCTION reset_ks_daily_counts() RETURNS VOID AS $$
BEGIN
  UPDATE ks_blueprint_popularity SET daily_uses = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reset_ks_weekly_counts() RETURNS VOID AS $$
BEGIN
  UPDATE ks_blueprint_popularity SET weekly_uses = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 获取用户蓝图推荐的函数
CREATE OR REPLACE FUNCTION get_blueprint_recommendations(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 5
) RETURNS TABLE (
  blueprint_id TEXT,
  recommendation_type TEXT,
  score NUMERIC,
  use_count INTEGER,
  last_used_at TIMESTAMPTZ
) AS $$
BEGIN
  -- 验证调用者身份
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: user_id mismatch';
  END IF;

  RETURN QUERY
  -- 用户最近使用的蓝图
  (
    SELECT
      us.blueprint_id,
      'recent'::TEXT as recommendation_type,
      (us.use_count * 0.5 + EXTRACT(EPOCH FROM (NOW() - us.last_used_at)) / -86400.0 * 0.5)::NUMERIC as score,
      us.use_count,
      us.last_used_at
    FROM ks_usage_stats us
    WHERE us.user_id = p_user_id
    ORDER BY us.last_used_at DESC
    LIMIT p_limit
  )
  UNION ALL
  -- 全局热门蓝图（排除用户已常用的）
  (
    SELECT
      bp.blueprint_id,
      'popular'::TEXT as recommendation_type,
      (bp.weekly_uses * 0.7 + bp.total_uses * 0.3)::NUMERIC as score,
      bp.total_uses as use_count,
      bp.updated_at as last_used_at
    FROM ks_blueprint_popularity bp
    WHERE NOT EXISTS (
      SELECT 1 FROM ks_usage_stats us
      WHERE us.user_id = p_user_id
        AND us.blueprint_id = bp.blueprint_id
        AND us.use_count >= 3
    )
    ORDER BY bp.weekly_uses DESC
    LIMIT p_limit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. 添加注释
COMMENT ON TABLE ks_usage_stats IS '用户蓝图使用统计表，用于个性化推荐';
COMMENT ON TABLE ks_blueprint_popularity IS '蓝图全局热度统计表，用于热门推荐';
COMMENT ON FUNCTION record_blueprint_usage IS '记录蓝图使用，更新用户统计和全局热度';
COMMENT ON FUNCTION get_blueprint_recommendations IS '获取蓝图推荐（最近使用 + 热门）';

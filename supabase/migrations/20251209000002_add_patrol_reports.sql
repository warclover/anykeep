-- ============================================================================
-- V4.0 巡检报告表迁移
--
-- 功能：存储整理大师主动巡检的报告数据
-- ============================================================================

-- ============================================================================
-- 1. 创建巡检报告表
-- ============================================================================

CREATE TABLE IF NOT EXISTS patrol_reports (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL DEFAULT 0,
  total_issues INTEGER NOT NULL DEFAULT 0,
  broken_links_count INTEGER NOT NULL DEFAULT 0,
  stale_bookmarks_count INTEGER NOT NULL DEFAULT 0,
  report_data JSONB NOT NULL DEFAULT '{}',
  report_period TEXT NOT NULL DEFAULT 'biweekly' CHECK (report_period IN ('weekly', 'biweekly', 'monthly')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引：用户最新报告查询
CREATE INDEX IF NOT EXISTS idx_patrol_reports_user_generated
  ON patrol_reports(user_id, generated_at DESC);

-- 索引：按时间查询
CREATE INDEX IF NOT EXISTS idx_patrol_reports_generated_at
  ON patrol_reports(generated_at DESC);

-- 评论
COMMENT ON TABLE patrol_reports IS 'V4.0 整理大师主动巡检报告';
COMMENT ON COLUMN patrol_reports.id IS '报告唯一标识 (patrol-{userId}-{timestamp})';
COMMENT ON COLUMN patrol_reports.user_id IS '用户 ID';
COMMENT ON COLUMN patrol_reports.overall_score IS '综合评分 (0-100)';
COMMENT ON COLUMN patrol_reports.total_issues IS '总问题数';
COMMENT ON COLUMN patrol_reports.broken_links_count IS '失效链接数量';
COMMENT ON COLUMN patrol_reports.stale_bookmarks_count IS '陈旧书签数量';
COMMENT ON COLUMN patrol_reports.report_data IS '报告详细数据 (JSON)';
COMMENT ON COLUMN patrol_reports.report_period IS '报告周期: weekly/biweekly/monthly';
COMMENT ON COLUMN patrol_reports.generated_at IS '报告生成时间';

-- ============================================================================
-- 2. RLS 策略
-- ============================================================================

ALTER TABLE patrol_reports ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的报告
CREATE POLICY "Users can view own patrol reports"
  ON patrol_reports
  FOR SELECT
  USING (auth.uid() = user_id);

-- 服务端可以插入报告（通过 service_role）
CREATE POLICY "Service can insert patrol reports"
  ON patrol_reports
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- 3. 添加通知偏好设置（扩展 profiles 表）
-- ============================================================================

-- 添加通知设置字段到 profiles 表（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles'
    AND column_name = 'patrol_notification_enabled'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN patrol_notification_enabled BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles'
    AND column_name = 'patrol_frequency'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN patrol_frequency TEXT DEFAULT 'biweekly'
    CHECK (patrol_frequency IN ('weekly', 'biweekly', 'monthly', 'never'));
  END IF;
END $$;

COMMENT ON COLUMN profiles.patrol_notification_enabled IS '是否接收巡检报告通知';
COMMENT ON COLUMN profiles.patrol_frequency IS '巡检频率偏好: weekly/biweekly/monthly/never';

-- ============================================================================
-- 4. 创建清理旧报告的函数（保留最近 10 条）
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_patrol_reports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 删除每个用户超过 10 条的旧报告
  DELETE FROM patrol_reports
  WHERE id IN (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY generated_at DESC) as rn
      FROM patrol_reports
    ) ranked
    WHERE rn > 10
  );
END;
$$;

COMMENT ON FUNCTION cleanup_old_patrol_reports IS '清理每个用户超过 10 条的旧巡检报告';

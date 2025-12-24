-- ================================================
-- 迁移名称: 20251224000002_add_reading_plans.sql
-- 描述: 添加阅读计划表，支持 ReadingPlannerSkill
-- 依赖: ai_skill_executions, bookmarks
-- ================================================

-- 1. 创建阅读计划表
CREATE TABLE IF NOT EXISTS public.reading_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 计划基本信息
  name TEXT NOT NULL,
  goal TEXT NOT NULL CHECK (goal IN ('clear_backlog', 'learn_topic', 'daily_routine', 'custom')),
  topic TEXT,  -- 学习主题（当 goal = 'learn_topic' 时）

  -- 时间配置
  daily_minutes INT NOT NULL CHECK (daily_minutes >= 15 AND daily_minutes <= 120),
  days_per_week INT NOT NULL CHECK (days_per_week >= 1 AND days_per_week <= 7),
  total_weeks INT CHECK (total_weeks >= 1 AND total_weeks <= 12),

  -- 计划日期
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- 状态
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),

  -- 偏好设置
  preferences JSONB NOT NULL DEFAULT '{}',  -- prioritizeBy, includeReview, groupByTopic

  -- 范围筛选
  scope_folder_id BIGINT REFERENCES public.folders(id) ON DELETE SET NULL,
  scope_tags TEXT[],
  scope_unread_only BOOLEAN DEFAULT false,

  -- 统计
  total_items INT NOT NULL DEFAULT 0,
  completed_items INT NOT NULL DEFAULT 0,
  total_reading_time INT NOT NULL DEFAULT 0,  -- 分钟

  -- 关联的 Skill 执行
  skill_execution_id UUID REFERENCES ai_skill_executions(id) ON DELETE SET NULL,

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 创建计划项表
CREATE TABLE IF NOT EXISTS public.reading_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES reading_plans(id) ON DELETE CASCADE,
  bookmark_id BIGINT NOT NULL REFERENCES public.bookmarks(id) ON DELETE CASCADE,

  -- 日程安排
  scheduled_day INT NOT NULL,           -- 第几天（从 1 开始）
  scheduled_date DATE NOT NULL,

  -- 项目信息
  estimated_read_time INT NOT NULL,     -- 预估阅读时间（分钟）
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  is_review BOOLEAN DEFAULT false,

  -- 状态
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),

  -- 完成信息
  completed_at TIMESTAMPTZ,
  actual_read_time INT,                 -- 实际阅读时间（分钟）

  -- 排序
  sort_order INT NOT NULL DEFAULT 0,

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 创建索引
-- reading_plans 索引
CREATE INDEX IF NOT EXISTS idx_reading_plans_user_id
  ON reading_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_plans_status
  ON reading_plans(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_reading_plans_dates
  ON reading_plans(start_date, end_date);

-- reading_plan_items 索引
CREATE INDEX IF NOT EXISTS idx_reading_plan_items_plan_id
  ON reading_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_reading_plan_items_bookmark_id
  ON reading_plan_items(bookmark_id);
CREATE INDEX IF NOT EXISTS idx_reading_plan_items_scheduled
  ON reading_plan_items(plan_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_reading_plan_items_status
  ON reading_plan_items(status) WHERE status = 'pending';

-- 4. 启用 RLS
ALTER TABLE reading_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_plan_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS 策略
DROP POLICY IF EXISTS "Users can manage own reading plans" ON reading_plans;
CREATE POLICY "Users can manage own reading plans"
  ON reading_plans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own plan items" ON reading_plan_items;
CREATE POLICY "Users can manage own plan items"
  ON reading_plan_items FOR ALL
  USING (
    plan_id IN (SELECT id FROM reading_plans WHERE user_id = auth.uid())
  )
  WITH CHECK (
    plan_id IN (SELECT id FROM reading_plans WHERE user_id = auth.uid())
  );

-- 6. 更新时间触发器
CREATE OR REPLACE FUNCTION update_reading_plan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reading_plans_updated_at ON reading_plans;
CREATE TRIGGER reading_plans_updated_at
  BEFORE UPDATE ON reading_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_reading_plan_updated_at();

-- 7. 计划项完成触发器（自动更新统计）
CREATE OR REPLACE FUNCTION update_plan_stats_on_item_complete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE reading_plans
    SET completed_items = completed_items + 1,
        updated_at = NOW()
    WHERE id = NEW.plan_id;
  ELSIF OLD.status = 'completed' AND NEW.status != 'completed' THEN
    UPDATE reading_plans
    SET completed_items = GREATEST(0, completed_items - 1),
        updated_at = NOW()
    WHERE id = NEW.plan_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS plan_items_complete_trigger ON reading_plan_items;
CREATE TRIGGER plan_items_complete_trigger
  AFTER UPDATE OF status ON reading_plan_items
  FOR EACH ROW
  EXECUTE FUNCTION update_plan_stats_on_item_complete();

-- 8. 注释
COMMENT ON TABLE reading_plans IS '阅读计划表，存储用户创建的阅读计划';
COMMENT ON TABLE reading_plan_items IS '阅读计划项表，存储计划中的具体阅读项';
COMMENT ON COLUMN reading_plans.goal IS '阅读目标：clear_backlog(清理积压), learn_topic(学习主题), daily_routine(日常习惯), custom(自定义)';
COMMENT ON COLUMN reading_plan_items.priority IS '优先级：high(高), medium(中), low(低)';
COMMENT ON COLUMN reading_plan_items.is_review IS '是否为复习内容';

-- 9. 辅助函数：获取今日阅读计划
CREATE OR REPLACE FUNCTION get_today_reading_items(p_user_id UUID)
RETURNS TABLE (
  item_id UUID,
  bookmark_id BIGINT,
  title TEXT,
  url TEXT,
  platform TEXT,
  estimated_read_time INT,
  priority TEXT,
  is_review BOOLEAN,
  status TEXT,
  plan_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rpi.id AS item_id,
    rpi.bookmark_id,
    b.title,
    b.url,
    b.platform,
    rpi.estimated_read_time,
    rpi.priority,
    rpi.is_review,
    rpi.status,
    rp.name AS plan_name
  FROM reading_plan_items rpi
  JOIN reading_plans rp ON rpi.plan_id = rp.id
  JOIN bookmarks b ON rpi.bookmark_id = b.id
  WHERE rp.user_id = p_user_id
    AND rp.status = 'active'
    AND rpi.scheduled_date = CURRENT_DATE
    AND rpi.status = 'pending'
  ORDER BY rpi.sort_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

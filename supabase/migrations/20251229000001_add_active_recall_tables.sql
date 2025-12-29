-- ================================================
-- 迁移名称: 20251229000001_add_active_recall_tables.sql
-- 描述: Brain-Sync 主动复习功能数据库表
-- 依赖: bookmarks, auth.users
-- 版本: v1.0.0
-- ================================================

-- ============================================
-- 1. Flashcards 表（核心）
-- ============================================
CREATE TABLE IF NOT EXISTS public.flashcards (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id BIGINT NOT NULL REFERENCES public.bookmarks(id) ON DELETE CASCADE,

  -- 问答内容
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  source_paragraph TEXT,  -- 原文核心段落引用

  -- 记忆状态
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'learning', 'mastered', 'paused')),
  ease_factor DECIMAL(3,2) DEFAULT 2.5 CHECK (ease_factor >= 1.3 AND ease_factor <= 2.5),
  interval_days INT DEFAULT 1,           -- 当前间隔天数
  repetitions INT DEFAULT 0,             -- 连续正确复习次数

  -- 调度时间
  next_review_at TIMESTAMPTZ,            -- 下次复习时间
  last_reviewed_at TIMESTAMPTZ,          -- 上次复习时间

  -- 元数据
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- 约束：同一用户同一书签的问题唯一
  CONSTRAINT flashcards_unique UNIQUE (user_id, bookmark_id, question)
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_flashcards_next_review
  ON public.flashcards(user_id, next_review_at)
  WHERE status != 'mastered';

CREATE INDEX IF NOT EXISTS idx_flashcards_bookmark
  ON public.flashcards(bookmark_id);

CREATE INDEX IF NOT EXISTS idx_flashcards_status
  ON public.flashcards(user_id, status);

-- ============================================
-- 2. 复习会话记录表
-- ============================================
CREATE TABLE IF NOT EXISTS public.review_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flashcard_id BIGINT NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,

  -- 用户反馈
  response VARCHAR(20) NOT NULL CHECK (response IN ('mastered', 'fuzzy', 'forgotten')),
  response_time_ms INT,           -- 思考时间（毫秒）

  -- 算法参数变化
  prev_interval INT,
  new_interval INT,
  prev_ease DECIMAL(3,2),
  new_ease DECIMAL(3,2),

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_sessions_flashcard
  ON public.review_sessions(flashcard_id);

CREATE INDEX IF NOT EXISTS idx_review_sessions_user_time
  ON public.review_sessions(user_id, created_at DESC);

-- ============================================
-- 3. 复习偏好设置表
-- ============================================
CREATE TABLE IF NOT EXISTS public.review_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 功能开关
  enabled BOOLEAN DEFAULT false,

  -- 时间偏好
  preferred_day VARCHAR(10) DEFAULT 'monday' CHECK (preferred_day IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  preferred_time TIME DEFAULT '09:00',
  timezone VARCHAR(50) DEFAULT 'Asia/Shanghai',

  -- 容量控制
  weekly_limit INT DEFAULT 10 CHECK (weekly_limit >= 1 AND weekly_limit <= 50),

  -- 筛选条件
  included_folder_ids BIGINT[],    -- 仅这些文件夹（空=全部）
  excluded_folder_ids BIGINT[],    -- 排除这些文件夹

  -- 通知偏好
  notification_channel VARCHAR(20) DEFAULT 'sidebar' CHECK (notification_channel IN ('sidebar', 'push', 'both')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 4. 每周复习队列快照表
-- ============================================
CREATE TABLE IF NOT EXISTS public.weekly_review_queue (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  week_start DATE NOT NULL,  -- 本周开始日期
  flashcard_ids BIGINT[] NOT NULL DEFAULT '{}',  -- 本周待复习的 Flashcard IDs
  completed_ids BIGINT[] DEFAULT '{}',  -- 已完成的 IDs

  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT weekly_queue_unique UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_queue_user_week
  ON public.weekly_review_queue(user_id, week_start DESC);

-- ============================================
-- 5. RLS 策略
-- ============================================
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_review_queue ENABLE ROW LEVEL SECURITY;

-- Flashcards RLS
DROP POLICY IF EXISTS "Users manage own flashcards" ON public.flashcards;
CREATE POLICY "Users manage own flashcards" ON public.flashcards
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Review Sessions RLS
DROP POLICY IF EXISTS "Users manage own review sessions" ON public.review_sessions;
CREATE POLICY "Users manage own review sessions" ON public.review_sessions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Review Preferences RLS
DROP POLICY IF EXISTS "Users manage own review preferences" ON public.review_preferences;
CREATE POLICY "Users manage own review preferences" ON public.review_preferences
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Weekly Queue RLS
DROP POLICY IF EXISTS "Users manage own weekly queue" ON public.weekly_review_queue;
CREATE POLICY "Users manage own weekly queue" ON public.weekly_review_queue
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 6. 注释
-- ============================================
COMMENT ON TABLE public.flashcards IS 'Brain-Sync 主动复习 Flashcard 表，存储问答对和 SM-2 算法参数';
COMMENT ON COLUMN public.flashcards.ease_factor IS 'SM-2 难度因子，范围 1.3-2.5，初始值 2.5';
COMMENT ON COLUMN public.flashcards.interval_days IS '当前复习间隔天数，根据 SM-2 算法动态调整';
COMMENT ON COLUMN public.flashcards.repetitions IS '连续正确复习次数，用于 SM-2 算法';
COMMENT ON COLUMN public.flashcards.status IS '状态：pending=待复习, learning=学习中, mastered=已掌握, paused=已暂停';

COMMENT ON TABLE public.review_sessions IS '复习会话记录，追踪每次复习的用户反馈和算法参数变化';
COMMENT ON COLUMN public.review_sessions.response IS '用户反馈：mastered=完美回忆, fuzzy=勉强回忆, forgotten=完全遗忘';

COMMENT ON TABLE public.review_preferences IS '用户复习偏好设置，包括时间、容量、通知等配置';
COMMENT ON COLUMN public.review_preferences.weekly_limit IS '每周复习上限，默认 10 条，范围 1-50';

COMMENT ON TABLE public.weekly_review_queue IS '每周复习队列快照，用于追踪本周待复习和已完成的 Flashcards';

-- ============================================
-- 7. 触发器：自动更新 updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.update_flashcards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS flashcards_updated_at ON public.flashcards;
CREATE TRIGGER flashcards_updated_at
  BEFORE UPDATE ON public.flashcards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_flashcards_updated_at();

CREATE OR REPLACE FUNCTION public.update_review_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS review_preferences_updated_at ON public.review_preferences;
CREATE TRIGGER review_preferences_updated_at
  BEFORE UPDATE ON public.review_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_review_preferences_updated_at();

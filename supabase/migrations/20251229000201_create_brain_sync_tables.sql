-- ============================================================================
-- Brain-Sync (Active Recall) 数据库迁移
-- 版本: 1.0
-- 日期: 2025-12-29
-- 描述: 创建主动复习功能所需的表结构
-- ============================================================================

-- ============================================
-- 1. Flashcards 表（核心）
-- ============================================
CREATE TABLE IF NOT EXISTS flashcards (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id BIGINT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,

  -- 问答内容
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  source_paragraph TEXT,  -- 原文核心段落

  -- SM-2 算法参数
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'learning', 'mastered')),
  ease_factor DECIMAL(4,2) DEFAULT 2.50
    CHECK (ease_factor >= 1.30 AND ease_factor <= 3.00),
  interval_days INT DEFAULT 1
    CHECK (interval_days >= 1 AND interval_days <= 365),
  repetitions INT DEFAULT 0
    CHECK (repetitions >= 0),

  -- 调度时间
  next_review_at TIMESTAMPTZ,
  last_reviewed_at TIMESTAMPTZ,

  -- 元数据
  difficulty VARCHAR(10) DEFAULT 'medium'
    CHECK (difficulty IN ('easy', 'medium', 'hard')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- 唯一约束：同一书签不重复问题
  CONSTRAINT flashcards_unique_question
    UNIQUE (user_id, bookmark_id, question)
);

-- 性能索引
CREATE INDEX IF NOT EXISTS idx_flashcards_user_status
  ON flashcards(user_id, status)
  WHERE status != 'mastered';

CREATE INDEX IF NOT EXISTS idx_flashcards_next_review
  ON flashcards(user_id, next_review_at)
  WHERE status != 'mastered' AND next_review_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_flashcards_bookmark
  ON flashcards(bookmark_id);

-- 添加表注释
COMMENT ON TABLE flashcards IS 'Brain-Sync 知识卡片表，存储 AI 生成的问答对和 SM-2 复习参数';
COMMENT ON COLUMN flashcards.ease_factor IS 'SM-2 难度因子，范围 1.3-3.0，越低越难';
COMMENT ON COLUMN flashcards.interval_days IS '当前复习间隔天数，范围 1-365';
COMMENT ON COLUMN flashcards.repetitions IS '连续正确复习次数';

-- ============================================
-- 2. 复习会话记录表
-- ============================================
CREATE TABLE IF NOT EXISTS review_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flashcard_id BIGINT NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,

  -- 用户反馈
  response VARCHAR(20) NOT NULL
    CHECK (response IN ('mastered', 'fuzzy', 'forgotten')),
  response_time_ms INT,  -- 思考时间

  -- SM-2 参数变化（用于分析和回溯）
  prev_interval INT NOT NULL,
  new_interval INT NOT NULL,
  prev_ease DECIMAL(4,2) NOT NULL,
  new_ease DECIMAL(4,2) NOT NULL,

  -- 会话上下文
  session_type VARCHAR(20) DEFAULT 'scheduled'
    CHECK (session_type IN ('scheduled', 'manual', 'chat')),

  created_at TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_review_sessions_flashcard
  ON review_sessions(flashcard_id);

CREATE INDEX IF NOT EXISTS idx_review_sessions_user_time
  ON review_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_review_sessions_response
  ON review_sessions(user_id, response, created_at DESC);

-- 添加表注释
COMMENT ON TABLE review_sessions IS 'Brain-Sync 复习会话记录，追踪每次复习的反馈和参数变化';

-- ============================================
-- 3. 复习偏好设置表
-- ============================================
CREATE TABLE IF NOT EXISTS review_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 功能开关
  enabled BOOLEAN DEFAULT false,

  -- 时间偏好
  preferred_day VARCHAR(10) DEFAULT 'monday'
    CHECK (preferred_day IN (
      'monday', 'tuesday', 'wednesday', 'thursday',
      'friday', 'saturday', 'sunday'
    )),
  preferred_time TIME DEFAULT '09:00',
  timezone VARCHAR(50) DEFAULT 'Asia/Shanghai',

  -- 容量控制
  weekly_limit INT DEFAULT 10
    CHECK (weekly_limit >= 3 AND weekly_limit <= 30),

  -- 筛选条件
  included_folder_ids BIGINT[] DEFAULT '{}',
  excluded_folder_ids BIGINT[] DEFAULT '{}',

  -- 通知偏好
  notification_channel VARCHAR(20) DEFAULT 'sidebar'
    CHECK (notification_channel IN ('sidebar', 'push', 'both', 'none')),

  -- 元数据
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 添加表注释
COMMENT ON TABLE review_preferences IS 'Brain-Sync 用户复习偏好设置';
COMMENT ON COLUMN review_preferences.weekly_limit IS '每周复习上限，范围 3-30';
COMMENT ON COLUMN review_preferences.notification_channel IS '通知渠道：sidebar/push/both/none';

-- ============================================
-- 4. 每周复习队列快照表
-- ============================================
CREATE TABLE IF NOT EXISTS weekly_review_queue (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 周期标识
  week_start DATE NOT NULL,  -- 本周一日期

  -- 队列内容
  flashcard_ids BIGINT[] NOT NULL DEFAULT '{}',
  completed_ids BIGINT[] NOT NULL DEFAULT '{}',

  -- 统计（计算列）
  total_count INT GENERATED ALWAYS AS (COALESCE(array_length(flashcard_ids, 1), 0)) STORED,
  completed_count INT GENERATED ALWAYS AS (COALESCE(array_length(completed_ids, 1), 0)) STORED,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- 每用户每周唯一
  CONSTRAINT weekly_queue_unique UNIQUE (user_id, week_start)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_weekly_queue_user_week
  ON weekly_review_queue(user_id, week_start DESC);

-- 添加表注释
COMMENT ON TABLE weekly_review_queue IS 'Brain-Sync 每周复习队列快照，用于追踪周进度';

-- ============================================
-- 5. 更新时间触发器
-- ============================================

-- 确保 update_updated_at_column 函数存在
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- flashcards 表触发器
DROP TRIGGER IF EXISTS update_flashcards_updated_at ON flashcards;
CREATE TRIGGER update_flashcards_updated_at
  BEFORE UPDATE ON flashcards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- review_preferences 表触发器
DROP TRIGGER IF EXISTS update_review_preferences_updated_at ON review_preferences;
CREATE TRIGGER update_review_preferences_updated_at
  BEFORE UPDATE ON review_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- weekly_review_queue 表触发器
DROP TRIGGER IF EXISTS update_weekly_review_queue_updated_at ON weekly_review_queue;
CREATE TRIGGER update_weekly_review_queue_updated_at
  BEFORE UPDATE ON weekly_review_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. RLS 策略
-- ============================================

-- 启用 RLS
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_review_queue ENABLE ROW LEVEL SECURITY;

-- flashcards 策略
DROP POLICY IF EXISTS "Users can view own flashcards" ON flashcards;
CREATE POLICY "Users can view own flashcards" ON flashcards
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own flashcards" ON flashcards;
CREATE POLICY "Users can create own flashcards" ON flashcards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own flashcards" ON flashcards;
CREATE POLICY "Users can update own flashcards" ON flashcards
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own flashcards" ON flashcards;
CREATE POLICY "Users can delete own flashcards" ON flashcards
  FOR DELETE USING (auth.uid() = user_id);

-- review_sessions 策略
DROP POLICY IF EXISTS "Users can manage own review sessions" ON review_sessions;
CREATE POLICY "Users can manage own review sessions" ON review_sessions
  FOR ALL USING (auth.uid() = user_id);

-- review_preferences 策略
DROP POLICY IF EXISTS "Users can manage own review preferences" ON review_preferences;
CREATE POLICY "Users can manage own review preferences" ON review_preferences
  FOR ALL USING (auth.uid() = user_id);

-- weekly_review_queue 策略
DROP POLICY IF EXISTS "Users can manage own weekly queue" ON weekly_review_queue;
CREATE POLICY "Users can manage own weekly queue" ON weekly_review_queue
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 完成
-- ============================================

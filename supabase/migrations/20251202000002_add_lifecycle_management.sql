-- =====================================================
-- 智能收藏生命周期管理系统 - 数据库迁移
-- 创建时间: 2025-12-02
-- 功能: 垃圾箱、失效检测、高价值文件夹
-- =====================================================

-- 1. Bookmarks 表新增字段
-- =====================================================

-- 垃圾箱状态字段
ALTER TABLE public.bookmarks
  ADD COLUMN IF NOT EXISTS is_in_trash BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trashed_at TIMESTAMPTZ;

-- 链接有效性状态字段
ALTER TABLE public.bookmarks
  ADD COLUMN IF NOT EXISTS is_invalid BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_validation_at TIMESTAMPTZ;

-- 字段注释
COMMENT ON COLUMN public.bookmarks.is_in_trash IS '是否在垃圾箱中（默认false）';
COMMENT ON COLUMN public.bookmarks.trashed_at IS '进入垃圾箱的时间戳';
COMMENT ON COLUMN public.bookmarks.is_invalid IS '链接是否失效（默认false）';
COMMENT ON COLUMN public.bookmarks.invalidated_at IS '首次检测到失效的时间';
COMMENT ON COLUMN public.bookmarks.last_validation_at IS '最后一次验证时间';

-- =====================================================
-- 2. Profiles 表新增字段（触发时间戳）
-- =====================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_trash_cleanup_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_validation_at TIMESTAMPTZ;

-- 字段注释
COMMENT ON COLUMN public.profiles.last_trash_cleanup_at IS '上次垃圾箱清理时间（用于30天检查）';
COMMENT ON COLUMN public.profiles.last_validation_at IS '上次失效检测时间（用于30天检查）';

-- =====================================================
-- 3. 创建 validation_history 表（检测历史记录）
-- =====================================================

CREATE TABLE IF NOT EXISTS public.validation_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 检测统计
  total_bookmarks INTEGER NOT NULL,        -- 用户总收藏数
  total_checked INTEGER NOT NULL,          -- 实际检测数量
  skipped_count INTEGER NOT NULL,          -- 跳过的数量（不可检测）
  valid_count INTEGER NOT NULL,
  invalid_count INTEGER NOT NULL,
  error_count INTEGER NOT NULL,

  -- 性能指标
  duration_ms INTEGER,
  average_response_time_ms INTEGER,

  -- 详细结果（JSONB 存储失效的书签 ID 和错误信息）
  invalid_bookmarks JSONB,

  -- 跳过原因统计（JSONB）
  skipped_reasons JSONB,

  -- 时间戳
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 表注释
COMMENT ON TABLE public.validation_history IS '失效检测历史记录表';

-- 字段注释
COMMENT ON COLUMN public.validation_history.total_bookmarks IS '用户总收藏数';
COMMENT ON COLUMN public.validation_history.total_checked IS '实际检测数量';
COMMENT ON COLUMN public.validation_history.skipped_count IS '跳过的数量（不可检测）';
COMMENT ON COLUMN public.validation_history.valid_count IS '有效链接数量';
COMMENT ON COLUMN public.validation_history.invalid_count IS '失效链接数量';
COMMENT ON COLUMN public.validation_history.error_count IS '检测出错数量';
COMMENT ON COLUMN public.validation_history.duration_ms IS '总耗时（毫秒）';
COMMENT ON COLUMN public.validation_history.average_response_time_ms IS '平均响应时间（毫秒）';
COMMENT ON COLUMN public.validation_history.invalid_bookmarks IS '失效收藏详情（ID + 错误）';
COMMENT ON COLUMN public.validation_history.skipped_reasons IS '跳过原因统计（平台 -> 数量）';

-- =====================================================
-- 4. RLS 策略（Row Level Security）
-- =====================================================

ALTER TABLE public.validation_history ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的检测历史
CREATE POLICY "Users can view own validation history"
  ON public.validation_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- =====================================================
-- 5. 性能优化索引
-- =====================================================

-- Bookmarks 表索引
CREATE INDEX IF NOT EXISTS idx_bookmarks_trash
  ON public.bookmarks(is_in_trash, trashed_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bookmarks_invalid
  ON public.bookmarks(is_invalid, invalidated_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bookmarks_high_value
  ON public.bookmarks(rating)
  WHERE deleted_at IS NULL AND rating = 5;

-- Validation History 表索引
CREATE INDEX IF NOT EXISTS idx_validation_history_user_time
  ON public.validation_history(user_id, created_at DESC);

-- =====================================================
-- 6. 数据完整性检查
-- =====================================================

-- 确保垃圾箱中的收藏有 trashed_at 时间戳
-- （仅针对新数据，现有数据不受影响）
ALTER TABLE public.bookmarks
  ADD CONSTRAINT chk_trash_timestamp
  CHECK (
    (is_in_trash = FALSE AND trashed_at IS NULL) OR
    (is_in_trash = TRUE AND trashed_at IS NOT NULL) OR
    (is_in_trash IS NULL)
  ) NOT VALID;

-- 确保失效收藏有 invalidated_at 时间戳
ALTER TABLE public.bookmarks
  ADD CONSTRAINT chk_invalid_timestamp
  CHECK (
    (is_invalid = FALSE AND invalidated_at IS NULL) OR
    (is_invalid = TRUE AND invalidated_at IS NOT NULL) OR
    (is_invalid IS NULL)
  ) NOT VALID;

-- =====================================================
-- 迁移完成
-- =====================================================

-- 输出迁移结果
DO $$
BEGIN
  RAISE NOTICE '✅ 智能收藏生命周期管理系统迁移完成';
  RAISE NOTICE '新增 bookmarks 表字段: is_in_trash, trashed_at, is_invalid, invalidated_at, last_validation_at';
  RAISE NOTICE '新增 profiles 表字段: last_trash_cleanup_at, last_validation_at';
  RAISE NOTICE '创建 validation_history 表';
  RAISE NOTICE '创建 5 个性能优化索引';
  RAISE NOTICE '配置 RLS 策略';
END $$;

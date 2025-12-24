-- ================================================
-- 迁移名称: 20251224000003_extend_bookmarks_reading_fields.sql
-- 描述: 为 bookmarks 表添加阅读和复习相关字段
-- ================================================

-- 1. 添加阅读次数字段
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS read_count INT NOT NULL DEFAULT 0;

-- 2. 添加最后阅读时间
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;

-- 3. 添加最后复习时间
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ;

-- 4. 添加复习阶段（艾宾浩斯曲线）
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS review_stage INT NOT NULL DEFAULT 0;

-- 5. 添加下次复习时间
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ;

-- 6. 添加预估阅读时间（分钟）
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS estimated_read_time INT;

-- 7. 添加内容长度（字符数）
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS content_length INT;

-- 8. 创建索引
CREATE INDEX IF NOT EXISTS idx_bookmarks_last_read_at
  ON bookmarks(user_id, last_read_at DESC)
  WHERE deleted_at IS NULL AND last_read_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookmarks_next_review_at
  ON bookmarks(user_id, next_review_at)
  WHERE deleted_at IS NULL AND next_review_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookmarks_review_stage
  ON bookmarks(user_id, review_stage)
  WHERE deleted_at IS NULL AND review_stage > 0;

-- 9. 添加注释
COMMENT ON COLUMN bookmarks.read_count IS '阅读次数';
COMMENT ON COLUMN bookmarks.last_read_at IS '最后阅读时间';
COMMENT ON COLUMN bookmarks.last_reviewed_at IS '最后复习时间';
COMMENT ON COLUMN bookmarks.review_stage IS '复习阶段（艾宾浩斯曲线）：0-5';
COMMENT ON COLUMN bookmarks.next_review_at IS '下次计划复习时间';
COMMENT ON COLUMN bookmarks.estimated_read_time IS '预估阅读时间（分钟）';
COMMENT ON COLUMN bookmarks.content_length IS '内容长度（字符数）';

-- 10. 辅助函数：更新阅读记录
CREATE OR REPLACE FUNCTION update_bookmark_read_record(
  p_bookmark_id BIGINT,
  p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE bookmarks
  SET
    read_count = read_count + 1,
    last_read_at = NOW(),
    is_read = true,
    updated_at = NOW()
  WHERE id = p_bookmark_id
    AND user_id = p_user_id
    AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. 辅助函数：计算下次复习时间（艾宾浩斯间隔）
CREATE OR REPLACE FUNCTION calculate_next_review_date(
  p_review_stage INT,
  p_retention_score INT DEFAULT 3
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  intervals INT[] := ARRAY[1, 3, 7, 14, 30, 60];
  next_stage INT;
  interval_days INT;
BEGIN
  -- 根据记忆评分调整阶段
  IF p_retention_score >= 4 THEN
    next_stage := LEAST(p_review_stage + 1, 5);  -- 记得好，进入下一阶段
  ELSIF p_retention_score <= 2 THEN
    next_stage := GREATEST(p_review_stage - 1, 0);  -- 记得差，回退一阶段
  ELSE
    next_stage := p_review_stage;  -- 一般，保持当前阶段
  END IF;

  interval_days := intervals[next_stage + 1];  -- PostgreSQL 数组从 1 开始

  RETURN NOW() + (interval_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 12. 辅助函数：更新复习记录
CREATE OR REPLACE FUNCTION update_bookmark_review_record(
  p_bookmark_id BIGINT,
  p_user_id UUID,
  p_retention_score INT DEFAULT 3
)
RETURNS TABLE (
  new_stage INT,
  next_review TIMESTAMPTZ
) AS $$
DECLARE
  current_stage INT;
  new_review_stage INT;
  next_review_time TIMESTAMPTZ;
BEGIN
  -- 获取当前复习阶段
  SELECT review_stage INTO current_stage
  FROM bookmarks
  WHERE id = p_bookmark_id AND user_id = p_user_id;

  -- 计算新阶段
  IF p_retention_score >= 4 THEN
    new_review_stage := LEAST(current_stage + 1, 5);
  ELSIF p_retention_score <= 2 THEN
    new_review_stage := GREATEST(current_stage - 1, 0);
  ELSE
    new_review_stage := current_stage;
  END IF;

  -- 计算下次复习时间
  next_review_time := calculate_next_review_date(new_review_stage, p_retention_score);

  -- 更新书签
  UPDATE bookmarks
  SET
    review_stage = new_review_stage,
    last_reviewed_at = NOW(),
    next_review_at = next_review_time,
    updated_at = NOW()
  WHERE id = p_bookmark_id
    AND user_id = p_user_id
    AND deleted_at IS NULL;

  RETURN QUERY SELECT new_review_stage, next_review_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

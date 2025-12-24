-- ================================================
-- 迁移名称: 20251224000001_add_review_records.sql
-- 描述: 添加复习记录表，支持 KnowledgeReviewSkill
-- 依赖: ai_skill_executions, bookmarks
-- ================================================

-- 1. 创建复习记录表
CREATE TABLE IF NOT EXISTS public.review_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id BIGINT NOT NULL REFERENCES public.bookmarks(id) ON DELETE CASCADE,

  -- 复习信息
  review_type TEXT NOT NULL DEFAULT 'spaced' CHECK (review_type IN ('spaced', 'sequential', 'random', 'manual')),

  -- 艾宾浩斯遗忘曲线追踪
  review_stage INT NOT NULL DEFAULT 0,  -- 当前复习阶段 (0-5, 对应间隔 1,3,7,14,30,60 天)
  next_review_at TIMESTAMPTZ,           -- 下次计划复习时间

  -- 复习效果评估 (1-5: 1=完全忘记, 5=完全掌握)
  retention_score INT CHECK (retention_score >= 1 AND retention_score <= 5),

  -- 关联的 Skill 执行
  skill_execution_id UUID REFERENCES ai_skill_executions(id) ON DELETE SET NULL,

  -- 元数据
  metadata JSONB DEFAULT '{}',  -- 可存储复习笔记、关键点等

  -- 时间戳
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_review_records_user_id
  ON review_records(user_id);
CREATE INDEX IF NOT EXISTS idx_review_records_bookmark_id
  ON review_records(bookmark_id);
CREATE INDEX IF NOT EXISTS idx_review_records_next_review
  ON review_records(user_id, next_review_at)
  WHERE next_review_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_review_records_reviewed_at
  ON review_records(reviewed_at DESC);

-- 3. 启用 RLS
ALTER TABLE review_records ENABLE ROW LEVEL SECURITY;

-- 4. RLS 策略
DROP POLICY IF EXISTS "Users can manage own review records" ON review_records;
CREATE POLICY "Users can manage own review records"
  ON review_records FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. 注释
COMMENT ON TABLE review_records IS '复习记录表，追踪用户的知识复习历史和艾宾浩斯遗忘曲线';
COMMENT ON COLUMN review_records.review_stage IS '复习阶段：0-5，对应艾宾浩斯间隔 1,3,7,14,30,60 天';
COMMENT ON COLUMN review_records.retention_score IS '记忆保持评分：1=完全忘记, 5=完全掌握';
COMMENT ON COLUMN review_records.next_review_at IS '基于艾宾浩斯曲线计算的下次复习时间';

-- 6. 辅助函数：获取需要复习的书签
CREATE OR REPLACE FUNCTION get_bookmarks_for_review(
  p_user_id UUID,
  p_limit INT DEFAULT 20,
  p_include_overdue BOOLEAN DEFAULT true
)
RETURNS TABLE (
  bookmark_id BIGINT,
  title TEXT,
  url TEXT,
  days_overdue INT,
  review_stage INT,
  last_retention_score INT
) AS $$
BEGIN
  RETURN QUERY
  WITH latest_reviews AS (
    SELECT DISTINCT ON (rr.bookmark_id)
      rr.bookmark_id,
      rr.review_stage,
      rr.retention_score,
      rr.next_review_at,
      rr.reviewed_at
    FROM review_records rr
    WHERE rr.user_id = p_user_id
    ORDER BY rr.bookmark_id, rr.reviewed_at DESC
  ),
  bookmarks_need_review AS (
    SELECT
      b.id AS bookmark_id,
      b.title,
      b.url,
      COALESCE(lr.review_stage, 0) AS review_stage,
      COALESCE(lr.retention_score, 0) AS last_retention_score,
      CASE
        WHEN lr.next_review_at IS NULL THEN
          EXTRACT(DAY FROM (NOW() - b.created_at))::INT
        ELSE
          EXTRACT(DAY FROM (NOW() - lr.next_review_at))::INT
      END AS days_overdue
    FROM bookmarks b
    LEFT JOIN latest_reviews lr ON b.id = lr.bookmark_id
    WHERE b.user_id = p_user_id
      AND b.deleted_at IS NULL
      AND (
        p_include_overdue = true
        OR lr.next_review_at IS NULL
        OR lr.next_review_at <= NOW()
      )
  )
  SELECT
    bnr.bookmark_id,
    bnr.title,
    bnr.url,
    bnr.days_overdue,
    bnr.review_stage,
    bnr.last_retention_score
  FROM bookmarks_need_review bnr
  WHERE bnr.days_overdue >= 0 OR p_include_overdue = true
  ORDER BY
    CASE WHEN bnr.days_overdue > 0 THEN 0 ELSE 1 END,  -- 逾期优先
    bnr.days_overdue DESC,
    bnr.review_stage ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

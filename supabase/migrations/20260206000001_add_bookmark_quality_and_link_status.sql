-- 添加 quality_score 和 link_status 字段到 bookmarks 表
-- 用于收件箱 "高价值" 和 "已失效" Tab 筛选

-- 1. 添加 quality_score 字段（质量评分，0-1 之间）
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS quality_score DECIMAL(3,2) DEFAULT NULL;

COMMENT ON COLUMN public.bookmarks.quality_score IS '内容质量评分 (0.00-1.00)，由 AI 分析生成';

-- 2. 添加 link_status 字段（链接状态）
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS link_status VARCHAR(20) DEFAULT 'unknown';

COMMENT ON COLUMN public.bookmarks.link_status IS '链接健康状态: unknown-未检测, healthy-正常, broken-失效, redirect-重定向';

-- 3. 添加约束确保 quality_score 在有效范围内
ALTER TABLE public.bookmarks
ADD CONSTRAINT bookmarks_quality_score_range
CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 1));

-- 4. 添加约束确保 link_status 是有效值
ALTER TABLE public.bookmarks
ADD CONSTRAINT bookmarks_link_status_check
CHECK (link_status IN ('unknown', 'healthy', 'broken', 'redirect'));

-- 5. 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_bookmarks_quality_score
ON public.bookmarks (quality_score)
WHERE quality_score IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bookmarks_link_status
ON public.bookmarks (link_status)
WHERE link_status = 'broken' AND deleted_at IS NULL;

-- 6. 添加 last_link_check_at 字段（记录最后一次链接检查时间）
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS last_link_check_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

COMMENT ON COLUMN public.bookmarks.last_link_check_at IS '最后一次链接健康检查时间';

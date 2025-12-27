-- ===========================================
-- B站视频字幕字段迁移
-- ===========================================
-- 版本: 1.0.0
-- 日期: 2025-12-27
-- 说明: 为 bookmarks 表添加视频字幕相关字段

-- -------------------------------------------
-- 1. 添加视频字幕字段
-- -------------------------------------------

-- 字幕文本内容
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS video_transcript TEXT;

COMMENT ON COLUMN public.bookmarks.video_transcript IS '视频字幕/文字稿内容';

-- 字幕字数统计
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS video_transcript_word_count INTEGER;

COMMENT ON COLUMN public.bookmarks.video_transcript_word_count IS '字幕字数统计';

-- 字幕提取状态
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS video_transcript_status VARCHAR(20)
CHECK (video_transcript_status IN ('pending', 'available', 'not_available', 'fetch_failed'));

COMMENT ON COLUMN public.bookmarks.video_transcript_status IS '字幕提取状态: pending-待提取, available-可用, not_available-无字幕, fetch_failed-提取失败';

-- -------------------------------------------
-- 2. 添加索引
-- -------------------------------------------

-- 字幕状态索引（用于查询有/无字幕的视频）
CREATE INDEX IF NOT EXISTS idx_bookmarks_video_transcript_status
ON public.bookmarks(video_transcript_status)
WHERE deleted_at IS NULL AND video_transcript_status IS NOT NULL;

-- 字幕全文搜索索引（用于搜索字幕内容）
CREATE INDEX IF NOT EXISTS idx_bookmarks_video_transcript_gin
ON public.bookmarks USING gin(to_tsvector('simple', COALESCE(video_transcript, '')))
WHERE deleted_at IS NULL AND video_transcript IS NOT NULL;

-- -------------------------------------------
-- 3. 更新已有 B站视频书签的状态为 pending
-- -------------------------------------------

-- 将现有 B站视频书签标记为待提取
UPDATE public.bookmarks
SET video_transcript_status = 'pending'
WHERE platform = 'BILIBILI'
  AND content_type = 'VIDEO'
  AND video_transcript_status IS NULL
  AND deleted_at IS NULL;

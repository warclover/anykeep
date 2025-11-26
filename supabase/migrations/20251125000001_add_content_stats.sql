-- 添加内容统计字段：字数和图片数量
-- Migration: 20251125000001_add_content_stats

-- 添加字数统计字段
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT NULL;

-- 添加图片数量字段
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS image_count INTEGER DEFAULT NULL;

-- 添加字段注释
COMMENT ON COLUMN public.bookmarks.word_count IS '原文字数统计';
COMMENT ON COLUMN public.bookmarks.image_count IS '原文图片数量';

-- 为字数统计添加索引（可用于按长度筛选）
CREATE INDEX IF NOT EXISTS idx_bookmarks_word_count
ON public.bookmarks(word_count)
WHERE word_count IS NOT NULL;

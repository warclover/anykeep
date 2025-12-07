-- =====================================================
-- Migration: Add AI Content Type Column
-- Description: Store AI-detected content type for bookmarks
-- Date: 2025-12-06
-- =====================================================

-- Add ai_content_type column to bookmarks table
-- This column stores the AI-detected content type:
-- - article: General articles (news, blogs, opinions)
-- - tutorial: Tutorials/guides (step-oriented)
-- - video: Video content (Bilibili, YouTube)
-- - tool: Tool/product introductions

ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS ai_content_type VARCHAR(20)
CHECK (ai_content_type IN ('article', 'tutorial', 'video', 'tool'));

-- Add ai_content_type_confidence column to store detection confidence
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS ai_content_type_confidence SMALLINT
CHECK (ai_content_type_confidence >= 0 AND ai_content_type_confidence <= 100);

-- Add index for filtering by content type
CREATE INDEX IF NOT EXISTS idx_bookmarks_ai_content_type
ON public.bookmarks(ai_content_type)
WHERE deleted_at IS NULL AND ai_content_type IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.bookmarks.ai_content_type IS 'AI-detected content type: article, tutorial, video, tool';
COMMENT ON COLUMN public.bookmarks.ai_content_type_confidence IS 'AI content type detection confidence (0-100)';

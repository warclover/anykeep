-- Migration: Add Classification Status to Bookmarks
-- Version: V3.1 - Unified Classification System
-- Date: 2025-12-07
--
-- Purpose: Add fields to track V3 classification status and results
-- This enables the frontend to poll for classification completion
-- and display accurate results.

-- ============================================================
-- 1. Add classification_status column
-- ============================================================
-- Status values:
--   'pending'    - Waiting for classification
--   'classified' - Successfully classified to a folder
--   'suggested'  - AI suggested a new folder (user can confirm)
--   'inbox'      - Low confidence, placed in inbox
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS classification_status TEXT DEFAULT 'pending';

-- Add check constraint for valid status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_classification_status'
  ) THEN
    ALTER TABLE bookmarks
    ADD CONSTRAINT chk_classification_status
    CHECK (classification_status IN ('pending', 'classified', 'suggested', 'inbox'));
  END IF;
END $$;

-- ============================================================
-- 2. Add classification_result JSONB column
-- ============================================================
-- Stores detailed classification results:
-- {
--   "folderId": number | null,
--   "folderName": string,
--   "confidence": number,
--   "action": "classify" | "suggest_new" | "inbox",
--   "suggestionId": number (optional),
--   "timestamp": ISO 8601 string
-- }
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS classification_result JSONB;

-- ============================================================
-- 3. Add index for efficient polling
-- ============================================================
-- Index on classification_status for efficient batch-status queries
CREATE INDEX IF NOT EXISTS idx_bookmarks_classification_status
ON bookmarks (classification_status)
WHERE classification_status = 'pending';

-- ============================================================
-- 4. Update existing records
-- ============================================================
-- Set status based on current folder_id:
--   - If folder_id is set -> 'classified'
--   - If folder_id is null -> 'pending'
UPDATE bookmarks
SET classification_status = CASE
  WHEN folder_id IS NOT NULL THEN 'classified'
  ELSE 'pending'
END
WHERE classification_status IS NULL;

-- ============================================================
-- 5. Add column comments
-- ============================================================
COMMENT ON COLUMN bookmarks.classification_status IS
  'V3 classification status: pending/classified/suggested/inbox';
COMMENT ON COLUMN bookmarks.classification_result IS
  'V3 classification result details (JSONB)';

-- ============================================================
-- 6. Log migration
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 20251207000005: Added classification_status and classification_result columns to bookmarks table';
END $$;

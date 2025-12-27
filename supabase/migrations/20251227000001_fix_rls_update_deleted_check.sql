-- Fix RLS UPDATE policy for bookmarks table
-- Issue: UPDATE policy doesn't check deleted_at, allowing updates to soft-deleted records
-- This is inconsistent with SELECT policy which requires deleted_at IS NULL

-- Drop the existing UPDATE policy
DROP POLICY IF EXISTS "Users can update own bookmarks" ON public.bookmarks;

-- Recreate with deleted_at check to match SELECT policy behavior
-- USING: determines which rows can be selected for update
--   - Must own the bookmark
--   - Bookmark must not be soft-deleted
-- WITH CHECK: validates the new row state after update
--   - Must still own the bookmark (prevents changing user_id)
CREATE POLICY "Users can update own bookmarks" ON public.bookmarks
    FOR UPDATE
    USING (auth.uid() = user_id AND deleted_at IS NULL)
    WITH CHECK (auth.uid() = user_id);

-- Also fix the folders table UPDATE policy for consistency
DROP POLICY IF EXISTS "Users can update own folders" ON public.folders;

CREATE POLICY "Users can update own folders" ON public.folders
    FOR UPDATE
    USING (auth.uid() = user_id AND deleted_at IS NULL)
    WITH CHECK (auth.uid() = user_id);

-- Add comment explaining the policy
COMMENT ON POLICY "Users can update own bookmarks" ON public.bookmarks IS
    'V4.2.27: Fixed to check deleted_at IS NULL, preventing updates to soft-deleted bookmarks';

COMMENT ON POLICY "Users can update own folders" ON public.folders IS
    'V4.2.27: Fixed to check deleted_at IS NULL, preventing updates to soft-deleted folders';

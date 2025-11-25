-- Fix RLS UPDATE policy for bookmarks table
-- Problem: Original policy missing WITH CHECK clause, causing soft deletes to fail
-- Error: "new row violates row-level security policy for table bookmarks" (code 42501)

-- Drop the incomplete UPDATE policy
DROP POLICY IF EXISTS "Users can update own bookmarks" ON public.bookmarks;

-- Recreate with both USING and WITH CHECK clauses
-- USING: determines which rows can be selected for update (must own the bookmark)
-- WITH CHECK: validates the new row state after update (must still own the bookmark)
CREATE POLICY "Users can update own bookmarks" ON public.bookmarks
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

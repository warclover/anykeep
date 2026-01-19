-- Fix RLS policies for folders table
-- Problem: Original "FOR ALL" policy with "deleted_at IS NULL" causes soft deletes to fail
-- Error: "new row violates row-level security policy for table folders" (code 42501)
--
-- Root cause: When updating deleted_at to a non-null value (soft delete),
-- the WITH CHECK clause (inherited from USING) rejects the new row because
-- it no longer satisfies "deleted_at IS NULL"

-- Drop the combined policy that causes the issue
DROP POLICY IF EXISTS "Users can manage own folders" ON public.folders;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can create own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete own folders" ON public.folders;

-- Create separate policies for each operation type:

-- SELECT: Only show non-deleted folders owned by the user
CREATE POLICY "Users can view own folders" ON public.folders
    FOR SELECT
    USING (auth.uid() = user_id AND deleted_at IS NULL);

-- INSERT: Only allow inserting folders owned by the user
CREATE POLICY "Users can create own folders" ON public.folders
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- UPDATE: Allow updating any folder owned by the user (including soft delete)
-- USING: determines which rows can be selected for update
-- WITH CHECK: validates the new row state (only checks ownership, not deleted_at)
CREATE POLICY "Users can update own folders" ON public.folders
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- DELETE: Allow deleting any folder owned by the user (for hard deletes if ever needed)
CREATE POLICY "Users can delete own folders" ON public.folders
    FOR DELETE
    USING (auth.uid() = user_id);

-- Fix: Team Leaders can't see Admin/SA names on project members
-- Cause: profiles SELECT only allows own/subtree/admin; join to admin profile is null.
-- Allow reading profiles of people who share a project with you (or you created).
-- Paste into Supabase SQL Editor and run once.

DROP POLICY IF EXISTS "profiles: read project teammates" ON profiles;
CREATE POLICY "profiles: read project teammates"
  ON profiles FOR SELECT
  USING (
    -- Fellow members on any shared project
    EXISTS (
      SELECT 1
      FROM public.project_members me
      JOIN public.project_members them
        ON them.project_id = me.project_id
      WHERE me.user_id = auth.uid()
        AND them.user_id = profiles.id
    )
    -- Creator can see everyone on projects they created
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.created_by = auth.uid()
        AND pm.user_id = profiles.id
    )
  );

-- Fix: infinite recursion in projects / project_members RLS
-- Cause: SELECT policies cross-queried each other under RLS.
-- Paste into Supabase SQL Editor and run once, then retry Create Project.

CREATE OR REPLACE FUNCTION public.can_manage_projects()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_my_role() IN ('super_admin', 'admin', 'team_leader');
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_select_project(p_project_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.get_my_role() IN ('super_admin', 'admin')
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = p_project_id AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = p_project_id AND pm.user_id = auth.uid()
    )
    OR (
      public.get_my_role() = 'team_leader'
      AND (
        EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id = p_project_id
            AND p.created_by IN (SELECT d.id FROM public.get_descendants(auth.uid()) d)
        )
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p_project_id
            AND (
              pm.user_id = auth.uid()
              OR pm.user_id IN (SELECT d.id FROM public.get_descendants(auth.uid()) d)
            )
        )
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      JOIN public.crm_clients c ON c.id = p.client_id
      WHERE p.id = p_project_id
        AND (
          c.assigned_to = auth.uid()
          OR c.team_leader_id = auth.uid()
          OR c.admin_id = auth.uid()
          OR c.created_by = auth.uid()
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_update_project(p_project_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.get_my_role() IN ('super_admin', 'admin')
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = p_project_id AND p.created_by = auth.uid()
    )
    OR (
      public.get_my_role() = 'team_leader'
      AND (
        EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id = p_project_id
            AND (
              p.created_by = auth.uid()
              OR p.created_by IN (SELECT d.id FROM public.get_descendants(auth.uid()) d)
            )
        )
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p_project_id AND pm.user_id = auth.uid()
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_select_project_member(p_project_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.get_my_role() IN ('super_admin', 'admin', 'team_leader')
    OR public.can_select_project(p_project_id);
$$;

DROP POLICY IF EXISTS "projects: read by scope" ON projects;
CREATE POLICY "projects: read by scope"
  ON projects FOR SELECT
  USING (public.can_select_project(id));

DROP POLICY IF EXISTS "projects: update by managers" ON projects;
CREATE POLICY "projects: update by managers"
  ON projects FOR UPDATE
  USING (public.can_update_project(id))
  WITH CHECK (public.can_manage_projects());

DROP POLICY IF EXISTS "project_members: read by scope" ON project_members;
CREATE POLICY "project_members: read by scope"
  ON project_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR added_by = auth.uid()
    OR public.can_select_project_member(project_id)
  );

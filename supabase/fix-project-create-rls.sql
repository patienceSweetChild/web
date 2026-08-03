-- Fix: Team Leader / Sales create project fails RLS on INSERT…RETURNING
-- Cause: SELECT policy only called can_select_project(id), which re-queries
-- projects under RLS. Admins short-circuit by role; TL/Sales need created_by.
-- Paste into Supabase SQL Editor and run once, then retry Create Project.

-- 1. Status allows unassigned
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN ('unassigned', 'active', 'on_hold', 'completed', 'cancelled'));

-- 2. Helpers
CREATE OR REPLACE FUNCTION public.can_manage_projects()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'team_leader')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_create_projects()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'team_leader', 'sales')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_activate_project()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
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

-- 3. Policies — creator can always SELECT own row (needed for INSERT RETURNING)
DROP POLICY IF EXISTS "projects: read by scope" ON projects;
CREATE POLICY "projects: read by scope"
  ON projects FOR SELECT
  USING (
    created_by = auth.uid()
    OR public.can_select_project(id)
  );

DROP POLICY IF EXISTS "projects: create by managers" ON projects;
DROP POLICY IF EXISTS "projects: create by creators" ON projects;
CREATE POLICY "projects: create by creators"
  ON projects FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND public.can_create_projects()
  );

DROP POLICY IF EXISTS "projects: update by managers" ON projects;
CREATE POLICY "projects: update by managers"
  ON projects FOR UPDATE
  USING (public.can_update_project(id))
  WITH CHECK (public.can_update_project(id));

DROP POLICY IF EXISTS "project_members: insert by managers" ON project_members;
DROP POLICY IF EXISTS "project_members: insert by creators" ON project_members;
CREATE POLICY "project_members: insert by creators"
  ON project_members FOR INSERT
  WITH CHECK (
    public.can_manage_projects()
    OR (
      public.get_my_role() = 'sales'
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_id AND p.created_by = auth.uid()
      )
    )
  );

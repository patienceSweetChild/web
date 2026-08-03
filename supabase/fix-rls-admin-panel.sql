-- Fix: Admin Panel / role not showing after promoting to super_admin
-- Cause: RLS policies on profiles queried profiles again → recursion / blocked reads.
-- Paste into Supabase SQL Editor, run once, then hard-refresh the app.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_above()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_descendants(root_id UUID)
RETURNS TABLE(id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE tree AS (
    SELECT p.id FROM public.profiles p WHERE p.manager_id = root_id
    UNION ALL
    SELECT p.id FROM public.profiles p
    JOIN tree t ON p.manager_id = t.id
  )
  SELECT id FROM tree;
$$;

DROP POLICY IF EXISTS "profiles: read own and subtree" ON profiles;
DROP POLICY IF EXISTS "profiles: update own basic fields" ON profiles;
DROP POLICY IF EXISTS "profiles: admin can update any" ON profiles;

CREATE POLICY "profiles: read own and subtree"
  ON profiles FOR SELECT
  USING (
    auth.uid() = id
    OR manager_id = auth.uid()
    OR id IN (SELECT d.id FROM get_descendants(auth.uid()) d)
    OR public.is_admin_or_above()
  );

CREATE POLICY "profiles: update own basic fields"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: admin can update any"
  ON profiles FOR UPDATE
  USING (public.is_admin_or_above());

-- Re-point other policies off recursive profiles lookups
DROP POLICY IF EXISTS "rbp: super_admin write" ON role_board_permissions;
CREATE POLICY "rbp: super_admin write"
  ON role_board_permissions FOR ALL
  USING (public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "crm_clients: read by scope" ON crm_clients;
CREATE POLICY "crm_clients: read by scope"
  ON crm_clients FOR SELECT
  USING (
    public.get_my_role() = 'super_admin'
    OR (
      public.get_my_role() = 'admin'
      AND (
        admin_id = auth.uid()
        OR assigned_to IN (SELECT d.id FROM get_descendants(auth.uid()) d)
        OR assigned_to IS NULL
      )
    )
    OR (
      public.get_my_role() = 'team_leader'
      AND (
        team_leader_id = auth.uid()
        OR assigned_to IN (SELECT d.id FROM get_descendants(auth.uid()) d)
      )
    )
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "crm_clients: create by non-viewers" ON crm_clients;
CREATE POLICY "crm_clients: create by non-viewers"
  ON crm_clients FOR INSERT
  WITH CHECK (public.get_my_role() IS DISTINCT FROM 'viewer');

DROP POLICY IF EXISTS "crm_clients: update by scope" ON crm_clients;
CREATE POLICY "crm_clients: update by scope"
  ON crm_clients FOR UPDATE
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR team_leader_id = auth.uid()
    OR admin_id = auth.uid()
    OR public.get_my_role() = 'super_admin'
  )
  WITH CHECK (public.get_my_role() IS DISTINCT FROM 'viewer');

DROP POLICY IF EXISTS "assignments: read by scope" ON client_assignments;
CREATE POLICY "assignments: read by scope"
  ON client_assignments FOR SELECT
  USING (
    assignee_id = auth.uid()
    OR assigned_by = auth.uid()
    OR public.get_my_role() IN ('super_admin', 'admin', 'team_leader')
  );

DROP POLICY IF EXISTS "assignments: insert by scope" ON client_assignments;
CREATE POLICY "assignments: insert by scope"
  ON client_assignments FOR INSERT
  WITH CHECK (
    public.get_my_role() IN ('super_admin', 'admin', 'team_leader')
  );

DROP POLICY IF EXISTS "pins: create by sa and admin" ON pins;
CREATE POLICY "pins: create by sa and admin"
  ON pins FOR INSERT
  WITH CHECK (public.is_admin_or_above());

DROP POLICY IF EXISTS "pins: update by sa and admin" ON pins;
CREATE POLICY "pins: update by sa and admin"
  ON pins FOR UPDATE
  USING (public.is_admin_or_above());

DROP POLICY IF EXISTS "pins: delete by sa and admin" ON pins;
CREATE POLICY "pins: delete by sa and admin"
  ON pins FOR DELETE
  USING (public.is_admin_or_above());

-- ═══════════════════════════════════════════════════════════════
-- OAS Pin Library — Project notifications + Unassigned workflow
-- Run AFTER projects.sql (and fix-projects-rls.sql if applied).
-- Paste into Supabase SQL Editor and run once.
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. STATUS: add unassigned
-- ─────────────────────────────────────────────
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN ('unassigned', 'active', 'on_hold', 'completed', 'cancelled'));

COMMENT ON COLUMN projects.status IS
  'unassigned | active | on_hold | completed | cancelled';

-- ─────────────────────────────────────────────
-- 2. HELPERS
-- ─────────────────────────────────────────────
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

-- Only Admin / Super Admin may change status
CREATE OR REPLACE FUNCTION public.enforce_project_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT public.can_activate_project() THEN
      RAISE EXCEPTION 'Only admin or super_admin can change project status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_project_status ON projects;
CREATE TRIGGER trg_enforce_project_status
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_project_status_change();

-- ─────────────────────────────────────────────
-- 3. RLS — create + update + members insert
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- 4. NOTIFY: project created
--    Always: all admin + super_admin (except creator)
--    Also: manager chain when sales/TL create
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_project_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  creator  profiles%ROWTYPE;
  mgr      profiles%ROWTYPE;
  grandmgr profiles%ROWTYPE;
  recip    RECORD;
  body_txt TEXT;
  title_txt TEXT;
  payload_json JSONB;
BEGIN
  SELECT * INTO creator FROM profiles WHERE id = NEW.created_by;
  IF creator.id IS NULL THEN
    RETURN NEW;
  END IF;

  body_txt := COALESCE(creator.full_name, creator.email) || ' created: ' || NEW.name
    || ' (' || INITCAP(REPLACE(NEW.status, '_', ' ')) || ')';
  title_txt := CASE
    WHEN NEW.status = 'unassigned' THEN 'New project needs review'
    ELSE 'New project created'
  END;
  payload_json := jsonb_build_object(
    'project_id', NEW.id,
    'project_name', NEW.name,
    'client_id', NEW.client_id,
    'actor_id', creator.id,
    'actor_name', COALESCE(creator.full_name, creator.email),
    'status', NEW.status
  );

  -- Manager chain for sales / TL (TL managers who aren't admin still get a ping)
  IF creator.role IN ('team_leader', 'sales') AND creator.manager_id IS NOT NULL THEN
    SELECT * INTO mgr FROM profiles WHERE id = creator.manager_id;

    IF mgr.id IS NOT NULL AND mgr.id <> creator.id AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = mgr.id
        AND n.type = 'project_created'
        AND n.payload->>'project_id' = NEW.id::text
        AND n.created_at > NOW() - INTERVAL '1 minute'
    ) THEN
      INSERT INTO notifications(user_id, type, title, body, payload)
      VALUES (mgr.id, 'project_created', title_txt, body_txt, payload_json);
    END IF;

    IF creator.role = 'sales' AND mgr.manager_id IS NOT NULL THEN
      SELECT * INTO grandmgr FROM profiles WHERE id = mgr.manager_id;
      IF grandmgr.id IS NOT NULL
         AND grandmgr.id <> creator.id
         AND grandmgr.role IN ('admin', 'super_admin', 'team_leader')
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.user_id = grandmgr.id
             AND n.type = 'project_created'
             AND n.payload->>'project_id' = NEW.id::text
             AND n.created_at > NOW() - INTERVAL '1 minute'
         )
      THEN
        INSERT INTO notifications(user_id, type, title, body, payload)
        VALUES (grandmgr.id, 'project_created', title_txt, body_txt, payload_json);
      END IF;
    END IF;
  END IF;

  -- Always notify every Admin and Super Admin (activators), except creator
  FOR recip IN
    SELECT id FROM profiles
    WHERE role IN ('admin', 'super_admin')
      AND id <> creator.id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = recip.id
        AND n.type = 'project_created'
        AND n.payload->>'project_id' = NEW.id::text
        AND n.created_at > NOW() - INTERVAL '1 minute'
    ) THEN
      INSERT INTO notifications(user_id, type, title, body, payload)
      VALUES (recip.id, 'project_created', title_txt, body_txt, payload_json);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_project_created ON projects;
CREATE TRIGGER trg_notify_project_created
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_project_created();

-- ─────────────────────────────────────────────
-- 5. NOTIFY: member added (no self)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_project_member_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor   profiles%ROWTYPE;
  proj    projects%ROWTYPE;
  aname   TEXT;
BEGIN
  IF NEW.user_id = NEW.added_by THEN
    RETURN NEW;
  END IF;

  SELECT * INTO actor FROM profiles WHERE id = NEW.added_by;
  SELECT * INTO proj FROM projects WHERE id = NEW.project_id;
  IF proj.id IS NULL THEN
    RETURN NEW;
  END IF;

  aname := COALESCE(actor.full_name, actor.email, 'Someone');

  IF NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id = NEW.user_id
      AND n.type = 'project_member_added'
      AND n.payload->>'project_id' = NEW.project_id::text
      AND n.created_at > NOW() - INTERVAL '1 minute'
  ) THEN
    INSERT INTO notifications(user_id, type, title, body, payload)
    VALUES (
      NEW.user_id,
      'project_member_added',
      'Added to project',
      aname || ' added you to ' || proj.name,
      jsonb_build_object(
        'project_id', proj.id,
        'project_name', proj.name,
        'client_id', proj.client_id,
        'actor_id', NEW.added_by,
        'actor_name', aname,
        'role_on_project', NEW.role_on_project
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_project_member_added ON project_members;
CREATE TRIGGER trg_notify_project_member_added
  AFTER INSERT ON project_members
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_project_member_added();

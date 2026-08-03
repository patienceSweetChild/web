-- ═══════════════════════════════════════════════════════════════
-- OAS Pin Library — Projects
-- Run AFTER rbac.sql (profiles, crm_clients, helpers).
-- Paste into Supabase SQL Editor and run once.
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. PROJECTS
--    One CRM client per project; staff via project_members.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'unassigned'
               CHECK (status IN ('unassigned', 'active', 'on_hold', 'completed', 'cancelled')),
               -- unassigned | active | on_hold | completed | cancelled
  client_id    UUID NOT NULL REFERENCES crm_clients(id) ON DELETE RESTRICT,
  start_date   DATE,
  end_date     DATE,
  notes        TEXT,
  created_by   UUID NOT NULL REFERENCES profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 2. PROJECT MEMBERS (staff: admin / TL / sales)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_members (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_on_project  TEXT NOT NULL,
                   -- 'admin' | 'team_leader' | 'sales'
  added_by         UUID NOT NULL REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

-- ─────────────────────────────────────────────
-- 3. INDEXES
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_projects_client     ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status     ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_start      ON projects(start_date);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user    ON project_members(user_id);

-- ─────────────────────────────────────────────
-- 4. UPDATED_AT
-- ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_projects_updated ON projects;
CREATE TRIGGER trg_projects_updated
  BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────
-- 5. HELPERS (SECURITY DEFINER — bypass RLS, avoid policy recursion)
-- ─────────────────────────────────────────────
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

-- All project read checks live here so policies never subquery
-- projects ↔ project_members (that caused infinite recursion).
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

-- ─────────────────────────────────────────────
-- 6. RLS
-- ─────────────────────────────────────────────
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "projects: delete by sa admin" ON projects;
CREATE POLICY "projects: delete by sa admin"
  ON projects FOR DELETE
  USING (public.get_my_role() IN ('super_admin', 'admin'));

DROP POLICY IF EXISTS "project_members: read by scope" ON project_members;
CREATE POLICY "project_members: read by scope"
  ON project_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR added_by = auth.uid()
    OR public.can_select_project_member(project_id)
  );

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

DROP POLICY IF EXISTS "project_members: delete by managers" ON project_members;
CREATE POLICY "project_members: delete by managers"
  ON project_members FOR DELETE
  USING (public.can_manage_projects());

DROP POLICY IF EXISTS "project_members: update by managers" ON project_members;
CREATE POLICY "project_members: update by managers"
  ON project_members FOR UPDATE
  USING (public.can_manage_projects())
  WITH CHECK (public.can_manage_projects());

-- ─────────────────────────────────────────────
-- 7. NOTIFICATIONS (project created + member added)
-- ─────────────────────────────────────────────
-- NOTIFY: project created
-- Always: all admin + super_admin (except creator)
-- Also: manager chain when sales/TL create
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

-- ─────────────────────────────────────────────
-- 8. Profiles: read project teammates
--    Must run AFTER project_members exists.
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles: read project teammates" ON profiles;
CREATE POLICY "profiles: read project teammates"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.project_members me
      JOIN public.project_members them
        ON them.project_id = me.project_id
      WHERE me.user_id = auth.uid()
        AND them.user_id = profiles.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.created_by = auth.uid()
        AND pm.user_id = profiles.id
    )
  );

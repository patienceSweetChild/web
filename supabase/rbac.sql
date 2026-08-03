-- ═══════════════════════════════════════════════════════════════
-- OAS Pin Library — RBAC Schema
-- Run AFTER schema.sql (pins / problems / catalogs).
-- Paste into Supabase SQL Editor and run once.
-- Use this file (rbac.sql), not rabc.sql.
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. TYPES
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'super_admin',
    'admin',
    'team_leader',
    'sales',
    'viewer'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- 2. PROFILES
--    Run schema.sql first (creates base profiles).
--    This upgrades it with RBAC columns.
--    manager_id = direct manager (one level up).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name  TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role       user_role NOT NULL DEFAULT 'viewer';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill full_name from display_name if present
UPDATE profiles
SET full_name = COALESCE(full_name, display_name, split_part(email, '@', 1))
WHERE full_name IS NULL;

-- Drop schema.sql profile policies so RBAC policies can replace them
DROP POLICY IF EXISTS "Users read own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;

-- Auto-create profile row on signup (replaces schema.sql version)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'display_name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    'viewer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Auth role must be able to fire the trigger function
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT INSERT ON public.profiles TO postgres, service_role;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────
-- 3. ROLE BOARD PERMISSIONS
--    Super Admin configures per-role per-board permissions.
--    board_id matches Next.js BoardId: catalog | formats | clients |
--    sell-channels | creative-packs | problems
-- ─────────────────────────────────────────────
CREATE TABLE role_board_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role        user_role NOT NULL,
  board_id    TEXT NOT NULL,
  can_view    BOOLEAN NOT NULL DEFAULT TRUE,
  can_create  BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit    BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete  BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by  UUID REFERENCES profiles(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role, board_id)
);

-- Seed default permissions (matches the diagram)
INSERT INTO role_board_permissions (role, board_id, can_view, can_create, can_edit, can_delete) VALUES
  -- super_admin — full access everywhere
  ('super_admin', 'catalog',        TRUE, TRUE,  TRUE,  TRUE),
  ('super_admin', 'formats',        TRUE, TRUE,  TRUE,  TRUE),
  ('super_admin', 'clients',        TRUE, TRUE,  TRUE,  TRUE),
  ('super_admin', 'sell-channels',  TRUE, TRUE,  TRUE,  TRUE),
  ('super_admin', 'creative-packs', TRUE, TRUE,  TRUE,  TRUE),
  ('super_admin', 'problems',       TRUE, TRUE,  TRUE,  TRUE),
  -- admin — full access everywhere
  ('admin',       'catalog',        TRUE, TRUE,  TRUE,  TRUE),
  ('admin',       'formats',        TRUE, TRUE,  TRUE,  TRUE),
  ('admin',       'clients',        TRUE, TRUE,  TRUE,  TRUE),
  ('admin',       'sell-channels',  TRUE, TRUE,  TRUE,  TRUE),
  ('admin',       'creative-packs', TRUE, TRUE,  TRUE,  TRUE),
  ('admin',       'problems',       TRUE, TRUE,  TRUE,  TRUE),
  -- team_leader — view only except clients board (edit own team clients)
  ('team_leader', 'catalog',        TRUE, FALSE, FALSE, FALSE),
  ('team_leader', 'formats',        TRUE, FALSE, FALSE, FALSE),
  ('team_leader', 'clients',        TRUE, FALSE, TRUE,  FALSE),
  ('team_leader', 'sell-channels',  TRUE, FALSE, FALSE, FALSE),
  ('team_leader', 'creative-packs', TRUE, FALSE, FALSE, FALSE),
  ('team_leader', 'problems',       TRUE, FALSE, FALSE, FALSE),
  -- sales — view only, no problems board
  ('sales',       'catalog',        TRUE, FALSE, FALSE, FALSE),
  ('sales',       'formats',        TRUE, FALSE, FALSE, FALSE),
  ('sales',       'clients',        TRUE, FALSE, FALSE, FALSE),
  ('sales',       'sell-channels',  TRUE, FALSE, FALSE, FALSE),
  ('sales',       'creative-packs', TRUE, FALSE, FALSE, FALSE),
  ('sales',       'problems',       FALSE,FALSE, FALSE, FALSE),
  -- viewer — view only, no problems board
  ('viewer',      'catalog',        TRUE, FALSE, FALSE, FALSE),
  ('viewer',      'formats',        TRUE, FALSE, FALSE, FALSE),
  ('viewer',      'clients',        TRUE, FALSE, FALSE, FALSE),
  ('viewer',      'sell-channels',  TRUE, FALSE, FALSE, FALSE),
  ('viewer',      'creative-packs', TRUE, FALSE, FALSE, FALSE),
  ('viewer',      'problems',       FALSE,FALSE, FALSE, FALSE);

-- ─────────────────────────────────────────────
-- 4. CRM CLIENTS  (separate from pin expectedClient tags)
-- ─────────────────────────────────────────────
CREATE TABLE crm_clients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  industry        TEXT,
  status          TEXT NOT NULL DEFAULT 'unassigned',
                  -- unassigned | active | inactive | closed
  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  assigned_to     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  team_leader_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  admin_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 5. CLIENT ASSIGNMENTS  (audit trail)
-- ─────────────────────────────────────────────
CREATE TABLE client_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES crm_clients(id) ON DELETE CASCADE,
  assignee_id     UUID NOT NULL REFERENCES profiles(id),
  assigned_by     UUID NOT NULL REFERENCES profiles(id),
  role_at_assign  user_role NOT NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 6. NOTIFICATIONS
-- ─────────────────────────────────────────────
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
              -- 'client_created' | 'client_assigned' | 'role_assigned'
  title       TEXT NOT NULL,
  body        TEXT,
  payload     JSONB,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 7. HELPERS (SECURITY DEFINER — bypass RLS safely)
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- 8. INDEXES
-- ─────────────────────────────────────────────
CREATE INDEX idx_profiles_manager         ON profiles(manager_id);
CREATE INDEX idx_profiles_role            ON profiles(role);
CREATE INDEX idx_crm_clients_assigned     ON crm_clients(assigned_to);
CREATE INDEX idx_crm_clients_created_by   ON crm_clients(created_by);
CREATE INDEX idx_crm_clients_status       ON crm_clients(status);
CREATE INDEX idx_crm_clients_tl           ON crm_clients(team_leader_id);
CREATE INDEX idx_notifications_user       ON notifications(user_id);
CREATE INDEX idx_notifications_unread     ON notifications(read_at) WHERE read_at IS NULL;
CREATE INDEX idx_rbp_role_board           ON role_board_permissions(role, board_id);

-- ─────────────────────────────────────────────
-- 9. UPDATED_AT triggers
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_crm_clients_updated
  BEFORE UPDATE ON crm_clients FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_rbp_updated
  BEFORE UPDATE ON role_board_permissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────
-- 10. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_board_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_assignments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications          ENABLE ROW LEVEL SECURITY;

-- ── profiles ──────────────────────────────────
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

-- Teammates on shared projects (e.g. TL sees Admin added to their project)
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

-- Users can update their own non-sensitive fields
CREATE POLICY "profiles: update own basic fields"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- SA/Admin can update any profile (including role + manager_id)
CREATE POLICY "profiles: admin can update any"
  ON profiles FOR UPDATE
  USING (public.is_admin_or_above());

-- ── role_board_permissions ──────────────────────
-- Anyone authenticated can read (needed by middleware + shell)
CREATE POLICY "rbp: read by authenticated"
  ON role_board_permissions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only super_admin can insert/update/delete
CREATE POLICY "rbp: super_admin write"
  ON role_board_permissions FOR ALL
  USING (public.get_my_role() = 'super_admin');

-- ── crm_clients ──────────────────────────────────
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

-- Non-viewer can create
CREATE POLICY "crm_clients: create by non-viewers"
  ON crm_clients FOR INSERT
  WITH CHECK (public.get_my_role() IS DISTINCT FROM 'viewer');

-- Scoped update
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

-- ── notifications ──────────────────────────────────
CREATE POLICY "notifications: own only"
  ON notifications FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications: mark read"
  ON notifications FOR UPDATE USING (user_id = auth.uid());

-- Service role / trigger can insert
CREATE POLICY "notifications: insert authenticated"
  ON notifications FOR INSERT WITH CHECK (TRUE);

-- ── client_assignments ──────────────────────────────────
CREATE POLICY "assignments: read by scope"
  ON client_assignments FOR SELECT
  USING (
    assignee_id = auth.uid()
    OR assigned_by = auth.uid()
    OR public.get_my_role() IN ('super_admin', 'admin', 'team_leader')
  );

CREATE POLICY "assignments: insert by scope"
  ON client_assignments FOR INSERT
  WITH CHECK (
    public.get_my_role() IN ('super_admin', 'admin', 'team_leader')
  );

-- ─────────────────────────────────────────────
-- 11. NOTIFICATION TRIGGER
--     Fires when a new CRM client is created by TL or Sales.
--     Notifies the chain above them + all Super Admins.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_on_client_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  creator      profiles%ROWTYPE;
  mgr          profiles%ROWTYPE;
  grandmgr     profiles%ROWTYPE;
  sa           RECORD;
BEGIN
  SELECT * INTO creator FROM profiles WHERE id = NEW.created_by;

  IF creator.role NOT IN ('team_leader','sales') THEN
    RETURN NEW;
  END IF;

  -- Notify direct manager (TL → Admin, Sales → TL)
  IF creator.manager_id IS NOT NULL THEN
    SELECT * INTO mgr FROM profiles WHERE id = creator.manager_id;

    INSERT INTO notifications(user_id, type, title, body, payload)
    VALUES (
      mgr.id, 'client_created', 'New client added',
      creator.full_name || ' added: ' || NEW.name,
      jsonb_build_object('client_id', NEW.id, 'client_name', NEW.name,
                         'actor_id', creator.id, 'actor_name', creator.full_name)
    ) ON CONFLICT DO NOTHING;

    -- If creator is Sales, also notify TL's manager (Admin)
    IF creator.role = 'sales' AND mgr.manager_id IS NOT NULL THEN
      SELECT * INTO grandmgr FROM profiles WHERE id = mgr.manager_id;
      IF grandmgr.role IN ('admin','super_admin') THEN
        INSERT INTO notifications(user_id, type, title, body, payload)
        VALUES (
          grandmgr.id, 'client_created', 'New client added',
          creator.full_name || ' added: ' || NEW.name,
          jsonb_build_object('client_id', NEW.id, 'client_name', NEW.name,
                             'actor_id', creator.id, 'actor_name', creator.full_name)
        ) ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;

  -- Always notify all super_admins
  FOR sa IN SELECT id FROM profiles WHERE role = 'super_admin' AND id <> creator.id LOOP
    INSERT INTO notifications(user_id, type, title, body, payload)
    VALUES (
      sa.id, 'client_created', 'New client added',
      creator.full_name || ' added: ' || NEW.name,
      jsonb_build_object('client_id', NEW.id, 'client_name', NEW.name,
                         'actor_id', creator.id, 'actor_name', creator.full_name)
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_client_created
  AFTER INSERT ON crm_clients
  FOR EACH ROW EXECUTE FUNCTION notify_on_client_created();

-- ─────────────────────────────────────────────
-- 12. PINS TABLE — add RLS so only SA/Admin can mutate
--     (assumes pins table already exists from schema.sql)
-- ─────────────────────────────────────────────
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

-- Drop permissive policies from schema.sql (RBAC replaces them)
DROP POLICY IF EXISTS "Authenticated read pins" ON pins;
DROP POLICY IF EXISTS "Authenticated write pins" ON pins;

-- Everyone authenticated can read pins
CREATE POLICY "pins: read by authenticated"
  ON pins FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only super_admin and admin can create pins
CREATE POLICY "pins: create by sa and admin"
  ON pins FOR INSERT
  WITH CHECK (public.is_admin_or_above());

-- Only super_admin and admin can update pins
CREATE POLICY "pins: update by sa and admin"
  ON pins FOR UPDATE
  USING (public.is_admin_or_above());

-- Only super_admin and admin can delete pins
CREATE POLICY "pins: delete by sa and admin"
  ON pins FOR DELETE
  USING (public.is_admin_or_above());

-- ─────────────────────────────────────────────
-- 13. USER BOARD PERMISSIONS (per-user overrides)
--     Super Admin can override what a user can do on each board
--     (separate from the user's role-based defaults).
--     Prefer running the standalone file:
--       supabase/user-board-permissions.sql
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_board_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  board_id      TEXT NOT NULL,
  can_view      BOOLEAN,
  can_create    BOOLEAN,
  can_edit      BOOLEAN,
  can_delete    BOOLEAN,
  updated_by    UUID REFERENCES public.profiles(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, board_id)
);

CREATE INDEX IF NOT EXISTS idx_ubp_user_board ON user_board_permissions(user_id, board_id);

ALTER TABLE user_board_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ubp: select own or super_admin" ON user_board_permissions;
CREATE POLICY "ubp: select own or super_admin"
  ON user_board_permissions FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "ubp: super_admin write" ON user_board_permissions;
CREATE POLICY "ubp: super_admin write"
  ON user_board_permissions FOR ALL
  USING (public.get_my_role() = 'super_admin');

-- ─────────────────────────────────────────────
-- 14. Effective permission helper
--     p_board_id avoids ambiguous column reference vs rbp.board_id
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_effective_board_permissions(p_board_id TEXT)
RETURNS TABLE (
  can_view    BOOLEAN,
  can_create  BOOLEAN,
  can_edit    BOOLEAN,
  can_delete  BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(ubp.can_view, rbp.can_view, FALSE)     AS can_view,
    COALESCE(ubp.can_create, rbp.can_create, FALSE) AS can_create,
    COALESCE(ubp.can_edit, rbp.can_edit, FALSE)     AS can_edit,
    COALESCE(ubp.can_delete, rbp.can_delete, FALSE) AS can_delete
  FROM role_board_permissions rbp
  LEFT JOIN user_board_permissions ubp
    ON ubp.board_id = rbp.board_id
   AND ubp.user_id = auth.uid()
  WHERE rbp.role = public.get_my_role()
    AND rbp.board_id = p_board_id;
$$;

-- ─────────────────────────────────────────────
-- 15. Mutation RPCs (enforce per-board perms)
--     These bypass RLS by running as the function owner (security definer),
--     while still enforcing board-level permissions in SQL.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.jsonb_to_text_array(j JSONB)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(j, '[]'::jsonb))),
    '{}'::text[]
  );
$$;

CREATE OR REPLACE FUNCTION public.upsert_pin_board(p_board_id TEXT, pin JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  perms RECORD;
  pin_id TEXT := pin->>'id';
  exists_row BOOLEAN := FALSE;
BEGIN
  SELECT * INTO perms FROM public.get_my_effective_board_permissions(p_board_id);

  SELECT EXISTS(SELECT 1 FROM public.pins WHERE id = pin_id) INTO exists_row;

  IF exists_row THEN
    IF perms.can_edit IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Permission denied: cannot edit pins on board %', p_board_id;
    END IF;
  ELSE
    IF perms.can_create IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Permission denied: cannot create pins on board %', p_board_id;
    END IF;
  END IF;

  INSERT INTO public.pins (
    id,
    name,
    subtype,
    branch,
    "column",
    price,
    lower,
    higher,
    "PM",
    status,
    tags,
    display_tags,
    notes,
    expected_client,
    selling,
    creative_pack,
    full_campaign,
    talent,
    problems,
    hooks,
    angles,
    executions,
    assets,
    format_assets,
    format_packs,
    stage,
    footer_label
  )
  SELECT
    pin->>'id',
    pin->>'name',
    pin->>'subtype',
    pin->>'branch',
    pin->>'column',
    pin->>'price',
    pin->>'lower',
    pin->>'higher',
    COALESCE((pin->'PM')::boolean, FALSE),
    pin->>'status',
    public.jsonb_to_text_array(pin->'tags'),
    public.jsonb_to_text_array(pin->'display_tags'),
    pin->>'notes',
    public.jsonb_to_text_array(pin->'expected_client'),
    public.jsonb_to_text_array(pin->'selling'),
    public.jsonb_to_text_array(pin->'creative_pack'),
    public.jsonb_to_text_array(pin->'full_campaign'),
    public.jsonb_to_text_array(pin->'talent'),
    public.jsonb_to_text_array(pin->'problems'),
    COALESCE((pin->>'hooks')::integer, 0),
    COALESCE((pin->>'angles')::integer, 0),
    COALESCE((pin->>'executions')::integer, 0),
    COALESCE((pin->>'assets')::integer, 0),
    COALESCE(pin->'format_assets', '{}'::jsonb),
    COALESCE(pin->'format_packs', '{}'::jsonb),
    COALESCE((pin->>'stage')::integer, 1),
    COALESCE(pin->>'footer_label', pin->>'subtype', '')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    subtype = EXCLUDED.subtype,
    branch = EXCLUDED.branch,
    "column" = EXCLUDED."column",
    price = EXCLUDED.price,
    lower = EXCLUDED.lower,
    higher = EXCLUDED.higher,
    "PM" = EXCLUDED."PM",
    status = EXCLUDED.status,
    tags = EXCLUDED.tags,
    display_tags = EXCLUDED.display_tags,
    notes = EXCLUDED.notes,
    expected_client = EXCLUDED.expected_client,
    selling = EXCLUDED.selling,
    creative_pack = EXCLUDED.creative_pack,
    full_campaign = EXCLUDED.full_campaign,
    talent = EXCLUDED.talent,
    problems = EXCLUDED.problems,
    hooks = EXCLUDED.hooks,
    angles = EXCLUDED.angles,
    executions = EXCLUDED.executions,
    assets = EXCLUDED.assets,
    format_assets = EXCLUDED.format_assets,
    format_packs = EXCLUDED.format_packs,
    stage = EXCLUDED.stage,
    footer_label = EXCLUDED.footer_label;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_pin_board(p_board_id TEXT, pin_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  perms RECORD;
BEGIN
  SELECT * INTO perms FROM public.get_my_effective_board_permissions(p_board_id);

  IF perms.can_delete IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Permission denied: cannot delete pins on board %', p_board_id;
  END IF;

  DELETE FROM public.pins WHERE id = pin_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_problem_board(p_board_id TEXT, problem JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  perms RECORD;
  problem_id TEXT := problem->>'id';
  exists_row BOOLEAN := FALSE;
BEGIN
  SELECT * INTO perms FROM public.get_my_effective_board_permissions(p_board_id);

  SELECT EXISTS(SELECT 1 FROM public.problems WHERE id = problem_id) INTO exists_row;

  IF exists_row THEN
    IF perms.can_edit IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Permission denied: cannot edit problems on board %', p_board_id;
    END IF;
  ELSE
    IF perms.can_create IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Permission denied: cannot create problems on board %', p_board_id;
    END IF;
  END IF;

  INSERT INTO public.problems (
    id,
    title,
    label,
    letter,
    expected_client
  )
  SELECT
    problem->>'id',
    problem->>'title',
    problem->>'label',
    problem->>'letter',
    public.jsonb_to_text_array(problem->'expected_client')
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    label = EXCLUDED.label,
    letter = EXCLUDED.letter,
    expected_client = EXCLUDED.expected_client;
END;
$$;

-- ─────────────────────────────────────────────
-- DONE. After running:
-- 1. Sign up your first user via the app login page
-- 2. In Supabase Table Editor → profiles → set role = 'super_admin' for that user
-- 3. Use /admin panel to assign all other roles from there
-- ─────────────────────────────────────────────

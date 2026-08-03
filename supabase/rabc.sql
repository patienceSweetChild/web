-- ─────────────────────────────────────────────
-- 1. TYPES
-- ─────────────────────────────────────────────
CREATE TYPE user_role AS ENUM (
  'super_admin',
  'admin',
  'team_leader',
  'sales',
  'viewer'
);

-- ─────────────────────────────────────────────
-- 2. PROFILES
--    One row per auth.users row.
--    manager_id = who manages this person (one level up).
-- ─────────────────────────────────────────────
CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    TEXT,
  email        TEXT NOT NULL,
  role         user_role NOT NULL DEFAULT 'viewer',
  manager_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  avatar_url   TEXT,
  phone        TEXT,
  department   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile row on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────────
-- 3. CLIENTS  (CRM entity, NOT pin tags)
-- ─────────────────────────────────────────────
CREATE TABLE clients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  industry        TEXT,
  status          TEXT NOT NULL DEFAULT 'unassigned',
                  -- unassigned | active | inactive | closed
  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  assigned_to     UUID REFERENCES profiles(id) ON DELETE SET NULL,
                  -- NULL = unassigned pool
  team_leader_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  admin_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 4. CLIENT ASSIGNMENTS  (audit trail)
-- ─────────────────────────────────────────────
CREATE TABLE client_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  assignee_id     UUID NOT NULL REFERENCES profiles(id),
  assigned_by     UUID NOT NULL REFERENCES profiles(id),
  role_at_assign  user_role NOT NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 5. NOTIFICATIONS
-- ─────────────────────────────────────────────
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
              -- 'client_created' | 'client_assigned' | 'user_assigned'
  title       TEXT NOT NULL,
  body        TEXT,
  payload     JSONB,
              -- { client_id, actor_id, actor_name, client_name }
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 6. HELPER: get all descendant user IDs
--    (walks manager_id tree downward)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_descendants(root_id UUID)
RETURNS TABLE(id UUID) LANGUAGE sql STABLE AS $$
  WITH RECURSIVE tree AS (
    SELECT p.id FROM profiles p WHERE p.manager_id = root_id
    UNION ALL
    SELECT p.id FROM profiles p
    JOIN tree t ON p.manager_id = t.id
  )
  SELECT id FROM tree;
$$;

-- ─────────────────────────────────────────────
-- 7. INDEXES
-- ─────────────────────────────────────────────
CREATE INDEX idx_profiles_manager     ON profiles(manager_id);
CREATE INDEX idx_profiles_role        ON profiles(role);
CREATE INDEX idx_clients_assigned_to  ON clients(assigned_to);
CREATE INDEX idx_clients_created_by   ON clients(created_by);
CREATE INDEX idx_clients_status       ON clients(status);
CREATE INDEX idx_notifications_user   ON notifications(user_id);
CREATE INDEX idx_notifications_read   ON notifications(read_at) WHERE read_at IS NULL;

-- ─────────────────────────────────────────────
-- 8. UPDATED_AT trigger helper
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_clients_updated
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────
-- 9. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;

-- ── profiles ──────────────────────────────────
-- Everyone can read profiles in their subtree + their own
CREATE POLICY "profiles: read own and subtree"
  ON profiles FOR SELECT
  USING (
    auth.uid() = id
    OR manager_id = auth.uid()
    OR id IN (SELECT id FROM get_descendants(auth.uid()))
    OR EXISTS (
      SELECT 1 FROM profiles me
      WHERE me.id = auth.uid()
        AND me.role IN ('super_admin', 'admin')
    )
  );

-- Only super_admin / admin can update roles and manager_id
CREATE POLICY "profiles: update own non-sensitive fields"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: admin can update role and manager"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles me
      WHERE me.id = auth.uid()
        AND me.role IN ('super_admin','admin')
    )
  );

-- ── clients ──────────────────────────────────
-- Read: super_admin/admin = all; TL = their team's; Sales = own
CREATE POLICY "clients: read by scope"
  ON clients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles me WHERE me.id = auth.uid()
        AND me.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles me WHERE me.id = auth.uid()
        AND me.role = 'admin'
        AND (
          admin_id = auth.uid()
          OR assigned_to IN (SELECT id FROM get_descendants(auth.uid()))
          OR assigned_to IS NULL
        )
    )
    OR EXISTS (
      SELECT 1 FROM profiles me WHERE me.id = auth.uid()
        AND me.role = 'team_leader'
        AND (
          team_leader_id = auth.uid()
          OR assigned_to IN (SELECT id FROM get_descendants(auth.uid()))
          OR (assigned_to IS NULL AND team_leader_id IS NULL
              AND created_by IN (SELECT id FROM get_descendants(auth.uid())))
        )
    )
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
  );

-- Create: all except viewer
CREATE POLICY "clients: create by non-viewers"
  ON clients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles me WHERE me.id = auth.uid()
        AND me.role <> 'viewer'
    )
  );

-- Update: non-viewers can update clients in their scope
CREATE POLICY "clients: update by scope"
  ON clients FOR UPDATE
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR team_leader_id = auth.uid()
    OR admin_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles me WHERE me.id = auth.uid()
        AND me.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles me WHERE me.id = auth.uid()
        AND me.role <> 'viewer'
    )
  );

-- ── notifications ──────────────────────────────────
CREATE POLICY "notifications: own only"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notifications: mark read"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- ── client_assignments ──────────────────────────────────
CREATE POLICY "assignments: read by scope"
  ON client_assignments FOR SELECT
  USING (
    assignee_id = auth.uid()
    OR assigned_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles me WHERE me.id = auth.uid()
        AND me.role IN ('super_admin','admin','team_leader')
    )
  );

-- ─────────────────────────────────────────────
-- 10. NOTIFICATION TRIGGER
--     Fires when a new CRM client is created by TL or Sales.
--     Notifies: the Admin above them + all Super Admins.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_on_client_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  creator     profiles%ROWTYPE;
  manager_rec profiles%ROWTYPE;
  sa          RECORD;
BEGIN
  SELECT * INTO creator FROM profiles WHERE id = NEW.created_by;

  -- Only trigger for TL or Sales-created clients
  IF creator.role NOT IN ('team_leader','sales') THEN
    RETURN NEW;
  END IF;

  -- Walk up to find Admin
  IF creator.manager_id IS NOT NULL THEN
    SELECT * INTO manager_rec FROM profiles WHERE id = creator.manager_id;

    IF manager_rec.role IN ('admin','team_leader') THEN
      INSERT INTO notifications(user_id, type, title, body, payload)
      VALUES (
        manager_rec.id,
        'client_created',
        'New client added',
        creator.full_name || ' added client: ' || NEW.name,
        jsonb_build_object(
          'client_id',   NEW.id,
          'client_name', NEW.name,
          'actor_id',    creator.id,
          'actor_name',  creator.full_name
        )
      );

      -- Also walk up to Admin if creator was Sales (TL → Admin)
      IF manager_rec.role = 'team_leader' AND manager_rec.manager_id IS NOT NULL THEN
        INSERT INTO notifications(user_id, type, title, body, payload)
        SELECT
          p.id,
          'client_created',
          'New client added',
          creator.full_name || ' added client: ' || NEW.name,
          jsonb_build_object(
            'client_id',   NEW.id,
            'client_name', NEW.name,
            'actor_id',    creator.id,
            'actor_name',  creator.full_name
          )
        FROM profiles p
        WHERE p.id = manager_rec.manager_id
          AND p.role IN ('admin','super_admin');
      END IF;
    END IF;
  END IF;

  -- Always notify all Super Admins
  FOR sa IN SELECT id FROM profiles WHERE role = 'super_admin' LOOP
    INSERT INTO notifications(user_id, type, title, body, payload)
    VALUES (
      sa.id,
      'client_created',
      'New client added',
      creator.full_name || ' added client: ' || NEW.name,
      jsonb_build_object(
        'client_id',   NEW.id,
        'client_name', NEW.name,
        'actor_id',    creator.id,
        'actor_name',  creator.full_name
      )
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_client_created
  AFTER INSERT ON clients
  FOR EACH ROW EXECUTE FUNCTION notify_on_client_created();

-- ─────────────────────────────────────────────
-- 11. GRANT insert on notifications to service role
--     (trigger runs as SECURITY DEFINER so this is already covered,
--      but explicit grant avoids surprises)
-- ─────────────────────────────────────────────
GRANT INSERT ON notifications TO service_role;
GRANT INSERT ON notifications TO authenticated;
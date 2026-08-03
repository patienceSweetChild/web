-- ═══════════════════════════════════════════════════════════════
-- OAS Pin Library — FRESH DATABASE BOOTSTRAP
-- Run once in Supabase SQL Editor on an empty project.
-- Order: schema → rbac → projects → onboarding → activity → logs
-- Then run flat-lay-schema.sql + npm run seed:flat-lay
-- ═══════════════════════════════════════════════════════════════


-- >>> BEGIN supabase/schema.sql
-- OAS Pin Library â€” Supabase schema
-- Run in Supabase SQL editor, then seed with: npm run seed

create extension if not exists "pgcrypto";

-- Profiles (mirrors auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.pins (
  id text primary key,
  name text not null default 'Untitled Pin',
  subtype text not null default 'Video',
  branch text not null default 'Ads',
  "column" text not null default 'videos',
  price text not null default 'â‚¹0',
  lower text not null default 'â‚¹0',
  higher text not null default 'â‚¹0',
  "PM" boolean not null default false,
  status text not null default 'Draft',
  tags text[] not null default '{}',
  display_tags text[] not null default '{}',
  notes text not null default '',
  expected_client text[] not null default '{}',
  selling text[] not null default '{}',
  creative_pack text[] not null default '{}',
  full_campaign text[] not null default '{}',
  talent text[] not null default '{}',
  problems text[] not null default '{}',
  hooks integer not null default 0,
  angles integer not null default 0,
  executions integer not null default 0,
  assets integer not null default 0,
  format_assets jsonb not null default '{}'::jsonb,
  format_packs jsonb not null default '{}'::jsonb,
  stage integer not null default 1,
  footer_label text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fix legacy unquoted PM â†’ "PM" (Postgres lowercased it to pm)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pins' and column_name = 'pm'
  ) then
    alter table public.pins rename column pm to "PM";
  end if;
end $$;

create table if not exists public.problems (
  id text primary key,
  title text not null,
  label text not null,
  letter text not null default '',
  expected_client text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.catalogs (
  key text primary key,
  options text[] not null default '{}'
);

create index if not exists pins_column_idx on public.pins ("column");
create index if not exists pins_status_idx on public.pins (status);
create index if not exists pins_branch_idx on public.pins (branch);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists pins_updated_at on public.pins;
create trigger pins_updated_at
  before update on public.pins
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: authenticated users can read/write (internal tool)
alter table public.pins enable row level security;
alter table public.problems enable row level security;
alter table public.catalogs enable row level security;
alter table public.profiles enable row level security;

create policy "Authenticated read pins" on public.pins
  for select to authenticated using (true);
create policy "Authenticated write pins" on public.pins
  for all to authenticated using (true) with check (true);

create policy "Authenticated read problems" on public.problems
  for select to authenticated using (true);
create policy "Authenticated write problems" on public.problems
  for all to authenticated using (true) with check (true);

create policy "Authenticated read catalogs" on public.catalogs
  for select to authenticated using (true);
create policy "Authenticated write catalogs" on public.catalogs
  for all to authenticated using (true) with check (true);

create policy "Users read own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "Users update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- <<< END supabase/schema.sql

-- >>> BEGIN supabase/rbac.sql
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- OAS Pin Library â€” RBAC Schema
-- Run AFTER schema.sql (pins / problems / catalogs).
-- Paste into Supabase SQL Editor and run once.
-- Use this file (rbac.sql), not rabc.sql.
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. TYPES
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 2. PROFILES
--    Run schema.sql first (creates base profiles).
--    This upgrades it with RBAC columns.
--    manager_id = direct manager (one level up).
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 3. ROLE BOARD PERMISSIONS
--    Super Admin configures per-role per-board permissions.
--    board_id matches Next.js BoardId: catalog | formats | clients |
--    sell-channels | creative-packs | problems
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  -- super_admin â€” full access everywhere
  ('super_admin', 'catalog',        TRUE, TRUE,  TRUE,  TRUE),
  ('super_admin', 'formats',        TRUE, TRUE,  TRUE,  TRUE),
  ('super_admin', 'clients',        TRUE, TRUE,  TRUE,  TRUE),
  ('super_admin', 'sell-channels',  TRUE, TRUE,  TRUE,  TRUE),
  ('super_admin', 'creative-packs', TRUE, TRUE,  TRUE,  TRUE),
  ('super_admin', 'problems',       TRUE, TRUE,  TRUE,  TRUE),
  -- admin â€” full access everywhere
  ('admin',       'catalog',        TRUE, TRUE,  TRUE,  TRUE),
  ('admin',       'formats',        TRUE, TRUE,  TRUE,  TRUE),
  ('admin',       'clients',        TRUE, TRUE,  TRUE,  TRUE),
  ('admin',       'sell-channels',  TRUE, TRUE,  TRUE,  TRUE),
  ('admin',       'creative-packs', TRUE, TRUE,  TRUE,  TRUE),
  ('admin',       'problems',       TRUE, TRUE,  TRUE,  TRUE),
  -- team_leader â€” view only except clients board (edit own team clients)
  ('team_leader', 'catalog',        TRUE, FALSE, FALSE, FALSE),
  ('team_leader', 'formats',        TRUE, FALSE, FALSE, FALSE),
  ('team_leader', 'clients',        TRUE, FALSE, TRUE,  FALSE),
  ('team_leader', 'sell-channels',  TRUE, FALSE, FALSE, FALSE),
  ('team_leader', 'creative-packs', TRUE, FALSE, FALSE, FALSE),
  ('team_leader', 'problems',       TRUE, FALSE, FALSE, FALSE),
  -- sales â€” view only, no problems board
  ('sales',       'catalog',        TRUE, FALSE, FALSE, FALSE),
  ('sales',       'formats',        TRUE, FALSE, FALSE, FALSE),
  ('sales',       'clients',        TRUE, FALSE, FALSE, FALSE),
  ('sales',       'sell-channels',  TRUE, FALSE, FALSE, FALSE),
  ('sales',       'creative-packs', TRUE, FALSE, FALSE, FALSE),
  ('sales',       'problems',       FALSE,FALSE, FALSE, FALSE),
  -- viewer â€” view only, no problems board
  ('viewer',      'catalog',        TRUE, FALSE, FALSE, FALSE),
  ('viewer',      'formats',        TRUE, FALSE, FALSE, FALSE),
  ('viewer',      'clients',        TRUE, FALSE, FALSE, FALSE),
  ('viewer',      'sell-channels',  TRUE, FALSE, FALSE, FALSE),
  ('viewer',      'creative-packs', TRUE, FALSE, FALSE, FALSE),
  ('viewer',      'problems',       FALSE,FALSE, FALSE, FALSE)
ON CONFLICT (role, board_id) DO NOTHING;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 4. CRM CLIENTS  (separate from pin expectedClient tags)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 5. CLIENT ASSIGNMENTS  (audit trail)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE client_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES crm_clients(id) ON DELETE CASCADE,
  assignee_id     UUID NOT NULL REFERENCES profiles(id),
  assigned_by     UUID NOT NULL REFERENCES profiles(id),
  role_at_assign  user_role NOT NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 6. NOTIFICATIONS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 7. HELPERS (SECURITY DEFINER â€” bypass RLS safely)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 8. INDEXES
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE INDEX idx_profiles_manager         ON profiles(manager_id);
CREATE INDEX idx_profiles_role            ON profiles(role);
CREATE INDEX idx_crm_clients_assigned     ON crm_clients(assigned_to);
CREATE INDEX idx_crm_clients_created_by   ON crm_clients(created_by);
CREATE INDEX idx_crm_clients_status       ON crm_clients(status);
CREATE INDEX idx_crm_clients_tl           ON crm_clients(team_leader_id);
CREATE INDEX idx_notifications_user       ON notifications(user_id);
CREATE INDEX idx_notifications_unread     ON notifications(read_at) WHERE read_at IS NULL;
CREATE INDEX idx_rbp_role_board           ON role_board_permissions(role, board_id);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 9. UPDATED_AT triggers
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 10. ROW LEVEL SECURITY
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_board_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_assignments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications          ENABLE ROW LEVEL SECURITY;

-- â”€â”€ profiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- Teammate profile visibility is created in projects.sql (needs project_members).

-- Users can update their own non-sensitive fields
CREATE POLICY "profiles: update own basic fields"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- SA/Admin can update any profile (including role + manager_id)
CREATE POLICY "profiles: admin can update any"
  ON profiles FOR UPDATE
  USING (public.is_admin_or_above());

-- â”€â”€ role_board_permissions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Anyone authenticated can read (needed by middleware + shell)
CREATE POLICY "rbp: read by authenticated"
  ON role_board_permissions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only super_admin can insert/update/delete
CREATE POLICY "rbp: super_admin write"
  ON role_board_permissions FOR ALL
  USING (public.get_my_role() = 'super_admin');

-- â”€â”€ crm_clients â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE POLICY "notifications: own only"
  ON notifications FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications: mark read"
  ON notifications FOR UPDATE USING (user_id = auth.uid());

-- Service role / trigger can insert
CREATE POLICY "notifications: insert authenticated"
  ON notifications FOR INSERT WITH CHECK (TRUE);

-- â”€â”€ client_assignments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 11. NOTIFICATION TRIGGER
--     Fires when a new CRM client is created by TL or Sales.
--     Notifies the chain above them + all Super Admins.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  -- Notify direct manager (TL â†’ Admin, Sales â†’ TL)
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 12. PINS TABLE â€” add RLS so only SA/Admin can mutate
--     (assumes pins table already exists from schema.sql)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 13. USER BOARD PERMISSIONS (per-user overrides)
--     Super Admin can override what a user can do on each board
--     (separate from the user's role-based defaults).
--     Prefer running the standalone file:
--       supabase/user-board-permissions.sql
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 14. Effective permission helper
--     p_board_id avoids ambiguous column reference vs rbp.board_id
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 15. Mutation RPCs (enforce per-board perms)
--     These bypass RLS by running as the function owner (security definer),
--     while still enforcing board-level permissions in SQL.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- DONE. After running:
-- 1. Sign up your first user via the app login page
-- 2. In Supabase Table Editor â†’ profiles â†’ set role = 'super_admin' for that user
-- 3. Use /admin panel to assign all other roles from there
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- <<< END supabase/rbac.sql

-- >>> BEGIN supabase/projects.sql
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- OAS Pin Library â€” Projects
-- Run AFTER rbac.sql (profiles, crm_clients, helpers).
-- Paste into Supabase SQL Editor and run once.
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. PROJECTS
--    One CRM client per project; staff via project_members.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 2. PROJECT MEMBERS (staff: admin / TL / sales)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 3. INDEXES
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE INDEX IF NOT EXISTS idx_projects_client     ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status     ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_start      ON projects(start_date);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user    ON project_members(user_id);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 4. UPDATED_AT
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP TRIGGER IF EXISTS trg_projects_updated ON projects;
CREATE TRIGGER trg_projects_updated
  BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 5. HELPERS (SECURITY DEFINER â€” bypass RLS, avoid policy recursion)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
-- projects â†” project_members (that caused infinite recursion).
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 6. RLS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 7. NOTIFICATIONS (project created + member added)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- NOTIFY: project created
-- Always: all admin + super_admin (except creator)
-- Also: manager chain when sales/TL create
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 5. NOTIFY: member added (no self)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 8. Profiles: read project teammates
--    Must run AFTER project_members exists.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- <<< END supabase/projects.sql

-- >>> BEGIN supabase/onboarding.sql
-- Onboarding: extend CRM clients, shortlists, chat, project pin items
-- Run in Supabase SQL Editor after rbac.sql / projects.sql.

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. Extend crm_clients profile fields
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.crm_clients
  ADD COLUMN IF NOT EXISTS company TEXT,
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_status TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS client_type TEXT,
  ADD COLUMN IF NOT EXISTS branding TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_clients_pipeline_status_check'
  ) THEN
    ALTER TABLE public.crm_clients
      ADD CONSTRAINT crm_clients_pipeline_status_check
      CHECK (pipeline_status IN (
        'new', 'audit', 'proposal', 'follow_up', 'won', 'lost', 'paused'
      ));
  END IF;
END $$;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 2. Client pin shortlists (current list / cart)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.client_pin_shortlists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES public.profiles(id),
  diagnosis   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id)
);

CREATE TABLE IF NOT EXISTS public.client_pin_shortlist_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shortlist_id  UUID NOT NULL REFERENCES public.client_pin_shortlists(id) ON DELETE CASCADE,
  pin_id        TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'manual',
                -- manual | ai | recommend | starter
  added_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shortlist_id, pin_id)
);

CREATE INDEX IF NOT EXISTS idx_shortlist_items_shortlist
  ON public.client_pin_shortlist_items(shortlist_id);

DROP TRIGGER IF EXISTS trg_client_pin_shortlists_updated ON public.client_pin_shortlists;
CREATE TRIGGER trg_client_pin_shortlists_updated
  BEFORE UPDATE ON public.client_pin_shortlists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 3. Onboarding chat
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.onboarding_chat_threads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, created_by)
);

CREATE TABLE IF NOT EXISTS public.onboarding_chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   UUID NOT NULL REFERENCES public.onboarding_chat_threads(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_chat_messages_thread
  ON public.onboarding_chat_messages(thread_id, created_at);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 4. Project pin items
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.project_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  pin_id      TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  added_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, pin_id)
);

CREATE INDEX IF NOT EXISTS idx_project_items_project
  ON public.project_items(project_id);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 5. RLS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.client_pin_shortlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_pin_shortlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_items ENABLE ROW LEVEL SECURITY;

-- Helpers: can see client (reuse crm scope via SELECT existence)
CREATE OR REPLACE FUNCTION public.can_access_client(p_client_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crm_clients c
    WHERE c.id = p_client_id
  );
$$;

DROP POLICY IF EXISTS "shortlists: select" ON public.client_pin_shortlists;
CREATE POLICY "shortlists: select" ON public.client_pin_shortlists
  FOR SELECT TO authenticated
  USING (public.can_access_client(client_id));

DROP POLICY IF EXISTS "shortlists: insert" ON public.client_pin_shortlists;
CREATE POLICY "shortlists: insert" ON public.client_pin_shortlists
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_client(client_id)
    AND created_by = auth.uid()
    AND public.get_my_role() <> 'viewer'
  );

DROP POLICY IF EXISTS "shortlists: update" ON public.client_pin_shortlists;
CREATE POLICY "shortlists: update" ON public.client_pin_shortlists
  FOR UPDATE TO authenticated
  USING (public.can_access_client(client_id) AND public.get_my_role() <> 'viewer');

DROP POLICY IF EXISTS "shortlist_items: select" ON public.client_pin_shortlist_items;
CREATE POLICY "shortlist_items: select" ON public.client_pin_shortlist_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_pin_shortlists s
      WHERE s.id = shortlist_id AND public.can_access_client(s.client_id)
    )
  );

DROP POLICY IF EXISTS "shortlist_items: insert" ON public.client_pin_shortlist_items;
CREATE POLICY "shortlist_items: insert" ON public.client_pin_shortlist_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() <> 'viewer'
    AND EXISTS (
      SELECT 1 FROM public.client_pin_shortlists s
      WHERE s.id = shortlist_id AND public.can_access_client(s.client_id)
    )
  );

DROP POLICY IF EXISTS "shortlist_items: delete" ON public.client_pin_shortlist_items;
CREATE POLICY "shortlist_items: delete" ON public.client_pin_shortlist_items
  FOR DELETE TO authenticated
  USING (
    public.get_my_role() <> 'viewer'
    AND EXISTS (
      SELECT 1 FROM public.client_pin_shortlists s
      WHERE s.id = shortlist_id AND public.can_access_client(s.client_id)
    )
  );

DROP POLICY IF EXISTS "chat_threads: select" ON public.onboarding_chat_threads;
CREATE POLICY "chat_threads: select" ON public.onboarding_chat_threads
  FOR SELECT TO authenticated
  USING (public.can_access_client(client_id));

DROP POLICY IF EXISTS "chat_threads: insert" ON public.onboarding_chat_threads;
CREATE POLICY "chat_threads: insert" ON public.onboarding_chat_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.can_access_client(client_id)
    AND public.get_my_role() <> 'viewer'
  );

DROP POLICY IF EXISTS "chat_messages: select" ON public.onboarding_chat_messages;
CREATE POLICY "chat_messages: select" ON public.onboarding_chat_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_chat_threads t
      WHERE t.id = thread_id AND public.can_access_client(t.client_id)
    )
  );

DROP POLICY IF EXISTS "chat_messages: insert" ON public.onboarding_chat_messages;
CREATE POLICY "chat_messages: insert" ON public.onboarding_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() <> 'viewer'
    AND EXISTS (
      SELECT 1 FROM public.onboarding_chat_threads t
      WHERE t.id = thread_id AND public.can_access_client(t.client_id)
    )
  );

DROP POLICY IF EXISTS "project_items: select" ON public.project_items;
CREATE POLICY "project_items: select" ON public.project_items
  FOR SELECT TO authenticated
  USING (public.can_select_project(project_id));

DROP POLICY IF EXISTS "project_items: insert" ON public.project_items;
CREATE POLICY "project_items: insert" ON public.project_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_update_project(project_id)
    OR public.can_select_project(project_id)
  );

DROP POLICY IF EXISTS "project_items: delete" ON public.project_items;
CREATE POLICY "project_items: delete" ON public.project_items
  FOR DELETE TO authenticated
  USING (
    public.can_update_project(project_id)
    OR public.can_select_project(project_id)
  );

-- <<< END supabase/onboarding.sql

-- >>> BEGIN supabase/user-activity.sql
-- User login / session activity (Admin Activity Log).
-- Paste into Supabase SQL Editor and run once.

CREATE TABLE IF NOT EXISTS public.user_login_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_key TEXT,
  service_name TEXT NOT NULL DEFAULT 'OAS Pin Library',
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_login_events_user
  ON public.user_login_events(user_id, started_at DESC);

ALTER TABLE public.user_login_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "login_events: insert own" ON public.user_login_events;
CREATE POLICY "login_events: insert own"
  ON public.user_login_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "login_events: read own or admin" ON public.user_login_events;
CREATE POLICY "login_events: read own or admin"
  ON public.user_login_events FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_admin_or_above()
  );

DROP POLICY IF EXISTS "login_events: update own or admin" ON public.user_login_events;
CREATE POLICY "login_events: update own or admin"
  ON public.user_login_events FOR UPDATE
  USING (
    auth.uid() = user_id
    OR public.is_admin_or_above()
  );

-- <<< END supabase/user-activity.sql

-- >>> BEGIN supabase/project-logs.sql
-- Project activity logs â€” every step on a project.
-- Run AFTER projects.sql (and fix-projects-rls.sql if applied).
-- Paste into Supabase SQL Editor and run once.

CREATE TABLE IF NOT EXISTS public.project_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  title       TEXT NOT NULL,
  detail      TEXT,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_logs_project
  ON public.project_logs(project_id, created_at DESC);

ALTER TABLE public.project_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_logs: read by project scope" ON public.project_logs;
CREATE POLICY "project_logs: read by project scope"
  ON public.project_logs FOR SELECT
  USING (public.can_select_project(project_id));

DROP POLICY IF EXISTS "project_logs: insert by actor" ON public.project_logs;
CREATE POLICY "project_logs: insert by actor"
  ON public.project_logs FOR INSERT
  WITH CHECK (
    actor_id = auth.uid()
    AND public.can_select_project(project_id)
  );

COMMENT ON TABLE public.project_logs IS
  'Audit trail of every action taken on a project (status, members, pins, notes, etc.).';

-- <<< END supabase/project-logs.sql

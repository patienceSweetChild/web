-- Onboarding: extend CRM clients, shortlists, chat, project pin items
-- Run in Supabase SQL Editor after rbac.sql / projects.sql.

-- ─────────────────────────────────────────────
-- 1. Extend crm_clients profile fields
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- 2. Client pin shortlists (current list / cart)
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- 3. Onboarding chat
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- 4. Project pin items
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- 5. RLS
-- ─────────────────────────────────────────────
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

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

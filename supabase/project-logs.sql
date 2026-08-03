-- Project activity logs — every step on a project.
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

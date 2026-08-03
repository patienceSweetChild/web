-- ─────────────────────────────────────────────
-- STANDALONE: User board permissions + mutation RPCs
-- Run this in Supabase SQL Editor (sections 13–15 of rbac.sql)
-- Fixed: board_id parameter was ambiguous vs table columns.
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

-- Parameter renamed to p_board_id to avoid ambiguity with rbp.board_id / ubp.board_id
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

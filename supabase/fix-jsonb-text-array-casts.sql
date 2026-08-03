-- Fix: cannot cast type jsonb to text[] (Postgres 42846)
-- Cause: upsert_pin_board / upsert_problem_board used (jsonb)::text[] which is invalid.
-- Run this in the Supabase SQL editor against your project.

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

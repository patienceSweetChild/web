-- ═══════════════════════════════════════════════════════════════
-- OAS Flat-Lay Library Schema
-- Run AFTER bootstrap-workspace.sql (or schema + rbac) on a fresh DB.
-- Canonical catalogue for data/flat_lay_*.json
-- Board UI still uses pins / problems / catalogs (seed materializes).
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. Problems (5 customer problem definitions)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.flat_problems (
  id                   TEXT PRIMARY KEY,
  customer_statement   TEXT NOT NULL,
  system_meaning       TEXT NOT NULL DEFAULT '',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 2. Parent groups
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.flat_parent_groups (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 3. Parent pins
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.flat_parent_pins (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  parent_group_id      TEXT NOT NULL REFERENCES public.flat_parent_groups(id) ON DELETE RESTRICT,
  description          TEXT NOT NULL DEFAULT '',
  problem_ids          TEXT[] NOT NULL DEFAULT '{}',
  is_parent            BOOLEAN NOT NULL DEFAULT TRUE,
  medium_independent   BOOLEAN NOT NULL DEFAULT TRUE,
  status               TEXT NOT NULL DEFAULT 'draft_for_review',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flat_parent_pins_group
  ON public.flat_parent_pins(parent_group_id);
CREATE INDEX IF NOT EXISTS idx_flat_parent_pins_status
  ON public.flat_parent_pins(status);

-- ─────────────────────────────────────────────
-- 4. Output types (video / image / print / web)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.flat_output_types (
  id    TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

-- ─────────────────────────────────────────────
-- 5. Child pins
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.flat_child_pins (
  id                 TEXT PRIMARY KEY,
  parent_id          TEXT NOT NULL REFERENCES public.flat_parent_pins(id) ON DELETE CASCADE,
  output_type        TEXT NOT NULL REFERENCES public.flat_output_types(id) ON DELETE RESTRICT,
  label              TEXT NOT NULL,
  available          BOOLEAN NOT NULL DEFAULT TRUE,
  default_selected   BOOLEAN NOT NULL DEFAULT FALSE,
  status             TEXT NOT NULL DEFAULT 'draft_for_review',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flat_child_pins_parent
  ON public.flat_child_pins(parent_id);
CREATE INDEX IF NOT EXISTS idx_flat_child_pins_output
  ON public.flat_child_pins(output_type);
CREATE INDEX IF NOT EXISTS idx_flat_child_pins_status
  ON public.flat_child_pins(status);

-- ─────────────────────────────────────────────
-- 6. Client packs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.flat_client_packs (
  id                         TEXT PRIMARY KEY,
  name                       TEXT NOT NULL,
  category                   TEXT NOT NULL DEFAULT '',
  client_group               TEXT NOT NULL DEFAULT '',
  expected_client_ids        TEXT[] NOT NULL DEFAULT '{}',
  entry_statements           TEXT[] NOT NULL DEFAULT '{}',
  problem_ids                TEXT[] NOT NULL DEFAULT '{}',
  default_campaign_mode      TEXT NOT NULL DEFAULT 'hybrid',
  allowed_campaign_modes     TEXT[] NOT NULL DEFAULT '{}',
  standalone_web_solutions   TEXT[] NOT NULL DEFAULT '{}',
  automation_solutions       TEXT[] NOT NULL DEFAULT '{}',
  commerce_build_refs        TEXT[] NOT NULL DEFAULT '{}',
  creative_parent_count      INT NOT NULL DEFAULT 0,
  creative_child_count       INT NOT NULL DEFAULT 0,
  editable                   BOOLEAN NOT NULL DEFAULT TRUE,
  status                     TEXT NOT NULL DEFAULT 'draft_for_review',
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.flat_client_pack_selections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id     TEXT NOT NULL REFERENCES public.flat_client_packs(id) ON DELETE CASCADE,
  parent_id   TEXT NOT NULL REFERENCES public.flat_parent_pins(id) ON DELETE CASCADE,
  child_ids   TEXT[] NOT NULL DEFAULT '{}',
  level       TEXT NOT NULL DEFAULT 'required',
  UNIQUE (pack_id, parent_id)
);

CREATE INDEX IF NOT EXISTS idx_flat_pack_selections_pack
  ON public.flat_client_pack_selections(pack_id);

-- ─────────────────────────────────────────────
-- 7. Commerce builds
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.flat_commerce_builds (
  id                      TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  platform_group          TEXT NOT NULL DEFAULT '',
  build_type              TEXT NOT NULL DEFAULT '',
  migrated_from_pack_ids  TEXT[] NOT NULL DEFAULT '{}',
  entry_statements        TEXT[] NOT NULL DEFAULT '{}',
  problem_ids             TEXT[] NOT NULL DEFAULT '{}',
  parent_ids              TEXT[] NOT NULL DEFAULT '{}',
  child_ids               TEXT[] NOT NULL DEFAULT '{}',
  deliverables            TEXT[] NOT NULL DEFAULT '{}',
  catalog_references      TEXT[] NOT NULL DEFAULT '{}',
  editable                BOOLEAN NOT NULL DEFAULT TRUE,
  status                  TEXT NOT NULL DEFAULT 'draft_for_review',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 8. Campaign modes (brandformance, brand_recall, …)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.flat_campaign_modes (
  id                     TEXT PRIMARY KEY,
  schema_version         TEXT NOT NULL DEFAULT 'flat-lay-campaign-mode-v1',
  name                   TEXT NOT NULL,
  customer_facing_name   TEXT NOT NULL DEFAULT '',
  description            TEXT NOT NULL DEFAULT '',
  primary_goal           TEXT NOT NULL DEFAULT '',
  status                 TEXT NOT NULL DEFAULT 'draft_for_review',
  body                   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 9. updated_at triggers
-- ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_flat_problems_updated ON public.flat_problems;
CREATE TRIGGER trg_flat_problems_updated
  BEFORE UPDATE ON public.flat_problems
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_flat_parent_pins_updated ON public.flat_parent_pins;
CREATE TRIGGER trg_flat_parent_pins_updated
  BEFORE UPDATE ON public.flat_parent_pins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_flat_child_pins_updated ON public.flat_child_pins;
CREATE TRIGGER trg_flat_child_pins_updated
  BEFORE UPDATE ON public.flat_child_pins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_flat_client_packs_updated ON public.flat_client_packs;
CREATE TRIGGER trg_flat_client_packs_updated
  BEFORE UPDATE ON public.flat_client_packs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_flat_commerce_builds_updated ON public.flat_commerce_builds;
CREATE TRIGGER trg_flat_commerce_builds_updated
  BEFORE UPDATE ON public.flat_commerce_builds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_flat_campaign_modes_updated ON public.flat_campaign_modes;
CREATE TRIGGER trg_flat_campaign_modes_updated
  BEFORE UPDATE ON public.flat_campaign_modes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────
-- 10. RLS (same posture as library pins — auth read; SA/Admin mutate)
-- ─────────────────────────────────────────────
ALTER TABLE public.flat_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flat_parent_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flat_parent_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flat_output_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flat_child_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flat_client_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flat_client_pack_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flat_commerce_builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flat_campaign_modes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'flat_problems',
    'flat_parent_groups',
    'flat_parent_pins',
    'flat_output_types',
    'flat_child_pins',
    'flat_client_packs',
    'flat_client_pack_selections',
    'flat_commerce_builds',
    'flat_campaign_modes'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ': read by authenticated', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (auth.uid() IS NOT NULL)',
      t || ': read by authenticated', t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ': write by sa and admin', t);
    EXECUTE format(
      $p$
      CREATE POLICY %I ON public.%I FOR ALL
        USING (public.get_my_role() IN ('super_admin', 'admin'))
        WITH CHECK (public.get_my_role() IN ('super_admin', 'admin'))
      $p$,
      t || ': write by sa and admin', t
    );
  END LOOP;
END $$;

COMMENT ON TABLE public.flat_parent_pins IS
  'Canonical flat-lay parent creative concepts (source: data/flat_lay_parent_pins.json).';
COMMENT ON TABLE public.flat_child_pins IS
  'Canonical flat-lay child outputs per parent (video/image/print/web).';
COMMENT ON TABLE public.flat_client_packs IS
  'Diagnosis-led client packs combining parents/children.';
COMMENT ON TABLE public.flat_commerce_builds IS
  'Selling-surface commerce builds (Amazon/Shopify/etc.).';
COMMENT ON TABLE public.flat_campaign_modes IS
  'Campaign mode documents (brandformance, brand_recall) with JSON body.';

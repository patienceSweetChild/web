import { createBrowserClient } from "@supabase/ssr";
import type { Pin, Problem, Catalogs } from "@/features/pins/types";

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase env vars are not configured");
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export type DbPin = {
  id: string;
  name: string;
  subtype: string;
  branch: string;
  column: string;
  price: string;
  lower: string;
  higher: string;
  PM: boolean;
  status: string;
  tags: string[];
  display_tags: string[];
  notes: string;
  expected_client: string[];
  selling: string[];
  creative_pack: string[];
  full_campaign: string[];
  talent: string[];
  problems: string[];
  hooks: number;
  angles: number;
  executions: number;
  assets: number;
  format_assets: Pin["formatAssets"];
  format_packs: Pin["formatPacks"];
  stage: number;
  footer_label: string;
};

export function dbPinToPin(row: DbPin): Pin {
  return {
    id: row.id,
    name: row.name,
    subtype: row.subtype,
    branch: row.branch,
    column: row.column,
    price: row.price,
    lower: row.lower,
    higher: row.higher,
    PM: row.PM,
    status: row.status,
    tags: row.tags || [],
    displayTags: row.display_tags || [],
    notes: row.notes || "",
    expectedClient: row.expected_client || [],
    selling: row.selling || [],
    creativePack: row.creative_pack || [],
    fullCampaign: row.full_campaign || [],
    talent: row.talent || [],
    problems: row.problems || [],
    hooks: row.hooks || 0,
    angles: row.angles || 0,
    executions: row.executions || 0,
    assets: row.assets || 0,
    formatAssets: row.format_assets || {},
    formatPacks: row.format_packs || {},
    stage: row.stage || 1,
    footerLabel: row.footer_label || row.subtype,
  };
}

export function pinToDbPin(pin: Pin): DbPin {
  return {
    id: pin.id,
    name: pin.name,
    subtype: pin.subtype,
    branch: String(pin.branch),
    column: String(pin.column),
    price: pin.price,
    lower: pin.lower,
    higher: pin.higher,
    PM: !!pin.PM,
    status: pin.status,
    tags: pin.tags || [],
    display_tags: pin.displayTags || [],
    notes: pin.notes || "",
    expected_client: pin.expectedClient || [],
    selling: pin.selling || [],
    creative_pack: pin.creativePack || [],
    full_campaign: pin.fullCampaign || [],
    talent: pin.talent || [],
    problems: pin.problems || [],
    hooks: pin.hooks || 0,
    angles: pin.angles || 0,
    executions: pin.executions || 0,
    assets: pin.assets || 0,
    format_assets: pin.formatAssets || {},
    format_packs: pin.formatPacks || {},
    stage: pin.stage || 1,
    footer_label: pin.footerLabel || pin.subtype,
  };
}

export type DbProblem = {
  id: string;
  title: string;
  label: string;
  letter: string;
  expected_client: string[];
};

export function dbProblemToProblem(row: DbProblem): Problem {
  return {
    id: row.id,
    title: row.title,
    label: row.label,
    letter: row.letter,
    expectedClient: row.expected_client || [],
  };
}

export function problemToDb(problem: Problem): DbProblem {
  return {
    id: problem.id,
    title: problem.title,
    label: problem.label,
    letter: problem.letter,
    expected_client: problem.expectedClient || [],
  };
}

export async function fetchAllFromSupabase() {
  const supabase = createClient();
  const [pinsRes, problemsRes, catalogsRes] = await Promise.all([
    supabase.from("pins").select("*").order("id"),
    supabase.from("problems").select("*").order("letter"),
    supabase.from("catalogs").select("*"),
  ]);

  if (pinsRes.error) throw pinsRes.error;
  if (problemsRes.error) throw problemsRes.error;
  if (catalogsRes.error) throw catalogsRes.error;

  const catalogs: Catalogs = {
    expectedClients: [],
    sellingOptions: [],
    creativePackOptions: [],
    fullCampaignOptions: [],
    talentOptions: [],
  };

  for (const row of catalogsRes.data || []) {
    if (row.key === "expectedClients") catalogs.expectedClients = row.options || [];
    if (row.key === "sellingOptions") catalogs.sellingOptions = row.options || [];
    if (row.key === "creativePackOptions") catalogs.creativePackOptions = row.options || [];
    if (row.key === "fullCampaignOptions") catalogs.fullCampaignOptions = row.options || [];
    if (row.key === "talentOptions") catalogs.talentOptions = row.options || [];
  }

  return {
    pins: (pinsRes.data || []).map((r) => dbPinToPin(r as DbPin)),
    problems: (problemsRes.data || []).map((r) => dbProblemToProblem(r as DbProblem)),
    catalogs,
  };
}

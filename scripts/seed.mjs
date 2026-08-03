/**
 * Seed Supabase from local JSON catalogues.
 *
 * Usage:
 *   npm run seed
 *
 * Loads .env then .env.local (local wins). Needs NEXT_PUBLIC_SUPABASE_URL
 * and SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvFile(filename) {
  const path = resolve(root, filename);
  if (!existsSync(path)) return false;
  // Strip BOM + normalize newlines (Windows CRLF)
  const env = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  for (const line of env.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
  return true;
}

// .env first, then .env.local overrides (same order as Next.js)
const loaded = [".env", ".env.local"].filter(loadEnvFile);

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)",
    !key && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);
  console.error(`Missing: ${missing.join(", ")}`);
  console.error(
    loaded.length
      ? `Loaded env from: ${loaded.join(", ")}`
      : "No .env or .env.local found in web/"
  );
  process.exit(1);
}

const pinsData = JSON.parse(
  readFileSync(resolve(root, "src/data/pins.json"), "utf8")
);
const problemsData = JSON.parse(
  readFileSync(resolve(root, "src/data/problems.json"), "utf8")
);

const supabase = createClient(url, key, { auth: { persistSession: false } });

function pinToRow(pin) {
  return {
    id: pin.id,
    name: pin.name,
    subtype: pin.subtype,
    branch: pin.branch,
    column: pin.column,
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

async function upsertChunks(table, rows, size = 100) {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { error } = await supabase.from(table).upsert(chunk);
    if (error) throw error;
    console.log(`  ${table}: ${Math.min(i + size, rows.length)}/${rows.length}`);
  }
}

async function main() {
  console.log("Seeding catalogs…");
  const catalogs = [
    { key: "expectedClients", options: pinsData.expectedClients || [] },
    { key: "sellingOptions", options: pinsData.sellingOptions || [] },
    { key: "creativePackOptions", options: pinsData.creativePackOptions || [] },
    { key: "fullCampaignOptions", options: pinsData.fullCampaignOptions || [] },
    {
      key: "talentOptions",
      options: pinsData.talentOptions || [
        "Founder",
        "Creator",
        "Model",
        "Customer / UGC",
        "No Talent",
      ],
    },
  ];
  await upsertChunks("catalogs", catalogs);

  console.log("Seeding problems…");
  await upsertChunks(
    "problems",
    (problemsData.problems || []).map((p) => ({
      id: p.id,
      title: p.title,
      label: p.label,
      letter: p.letter,
      expected_client: p.expectedClient || [],
    }))
  );

  console.log("Seeding pins…");
  await upsertChunks("pins", (pinsData.pins || []).map(pinToRow));

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

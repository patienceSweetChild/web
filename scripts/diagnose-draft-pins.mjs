/**
 * Diagnose draft counts on formats board.
 * Usage: node scripts/diagnose-draft-pins.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvFile(filename) {
  const path = resolve(root, filename);
  if (!existsSync(path)) return;
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
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key, { auth: { persistSession: false } });

const child = JSON.parse(
  readFileSync(resolve(root, "data/flat_lay_child_pins.json"), "utf8")
);
const childIds = new Set((child.children || []).map((c) => c.id));

const { data: pins, error } = await supabase
  .from("pins")
  .select("id,name,status,column,subtype,branch");
if (error) throw error;

function norm(status) {
  const s = String(status || "").trim().toLowerCase();
  if (s === "draft") return "Draft";
  if (s === "archived") return "Archived";
  return "Active"; // Published and Active both count as Active
}

const drafts = pins.filter((p) => norm(p.status) === "Draft");
const draftChildren = drafts.filter((p) => childIds.has(p.id));
const draftParents = drafts.filter(
  (p) => p.subtype === "Parent" || (!p.id.includes("__") && !p.id.startsWith("auto__"))
);
const draftAuto = drafts.filter((p) => p.id.startsWith("auto__"));

console.log("total pins", pins.length);
console.log("draft total (UI isDraft)", drafts.length);
console.log("  of which flat-lay children", draftChildren.length);
console.log("  of which parents", draftParents.length);
console.log("  of which automation", draftAuto.length);
console.log(
  "status values on drafts",
  [...new Set(drafts.map((p) => p.status))]
);
console.log(
  "status distribution all pins",
  pins.reduce((a, p) => {
    a[p.status] = (a[p.status] || 0) + 1;
    return a;
  }, {})
);
console.log(
  "draft parents sample",
  draftParents.slice(0, 8).map((p) => `${p.id} | ${p.subtype} | ${p.column}`)
);

// Formats board: VIDEO PINS etc only show isActive — parents Draft still land in DRAFT column
const draftInVideosCol = drafts.filter((p) => p.column === "videos");
console.log("drafts with column=videos (show in DRAFT / also block videos col)", draftInVideosCol.length);

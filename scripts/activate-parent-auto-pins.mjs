/**
 * Set parent + automation board pins to Active.
 * Usage: node scripts/activate-parent-auto-pins.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(filename) {
  const path = resolve(root, filename);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv(".env");
loadEnv(".env.local");

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const parent = JSON.parse(
  readFileSync(resolve(root, "data/flat_lay_parent_pins.json"), "utf8")
);
const parentIds = (parent.parents || []).map((p) => p.id);

const { data: autoPins, error: autoErr } = await supabase
  .from("pins")
  .select("id")
  .like("id", "auto__%");
if (autoErr) throw autoErr;
const autoIds = (autoPins || []).map((p) => p.id);

const ids = [...parentIds, ...autoIds];
let updated = 0;
for (let i = 0; i < ids.length; i += 100) {
  const chunk = ids.slice(i, i + 100);
  const { data, error } = await supabase
    .from("pins")
    .update({ status: "Active" })
    .in("id", chunk)
    .select("id");
  if (error) throw error;
  updated += (data || []).length;
}

if (parentIds.length) {
  const { error } = await supabase
    .from("flat_parent_pins")
    .update({ status: "active" })
    .in("id", parentIds);
  if (error) throw error;
}

console.log(
  `Done. Active: ${updated} pins (${parentIds.length} parents + ${autoIds.length} automation).`
);

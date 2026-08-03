/**
 * One-shot: set all flat-lay child board pins to Active.
 * Usage: node scripts/activate-child-pins.mjs
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

[".env", ".env.local"].forEach(loadEnvFile);

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const childData = JSON.parse(
  readFileSync(resolve(root, "data/flat_lay_child_pins.json"), "utf8")
);
const ids = (childData.children || []).map((c) => c.id);

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
  console.log(`pins: ${Math.min(i + 100, ids.length)}/${ids.length}`);
}

for (let i = 0; i < ids.length; i += 100) {
  const chunk = ids.slice(i, i + 100);
  const { error } = await supabase
    .from("flat_child_pins")
    .update({ status: "active" })
    .in("id", chunk);
  if (error) throw error;
}

console.log(`Done. Set Active on ${updated} child board pins.`);

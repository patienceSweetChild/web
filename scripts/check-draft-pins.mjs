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

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const child = JSON.parse(
  readFileSync(resolve(root, "data/flat_lay_child_pins.json"), "utf8")
);
const childIds = new Set(child.children.map((c) => c.id));

const { data: pins, error } = await s
  .from("pins")
  .select("id,name,status,column,subtype,branch");
if (error) throw error;

const drafts = (pins || []).filter(
  (p) => String(p.status).toLowerCase() === "draft"
);
const draftChildren = drafts.filter((p) => childIds.has(p.id));
const draftParents = drafts.filter((p) => p.subtype === "Parent");
const draftAuto = drafts.filter((p) => String(p.id).startsWith("auto__"));
const other = drafts.filter(
  (p) =>
    !childIds.has(p.id) &&
    p.subtype !== "Parent" &&
    !String(p.id).startsWith("auto__")
);

console.log("total pins", pins.length);
console.log("total Draft", drafts.length);
console.log("Draft flat-lay children", draftChildren.length);
console.log("Draft parents", draftParents.length);
console.log("Draft automation", draftAuto.length);
console.log("Draft other", other.length, other.map((p) => p.id).slice(0, 20));
console.log(
  "Active children",
  (pins || []).filter(
    (p) => childIds.has(p.id) && String(p.status).toLowerCase() === "active"
  ).length,
  "of",
  childIds.size
);

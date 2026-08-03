/**
 * Seed flat-lay tables from data/flat_lay_*.json, then materialize
 * board-compatible pins / problems / catalogs for the existing UI.
 *
 * Usage:
 *   npm run seed:flat-lay
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY.
 * Run supabase/bootstrap-workspace.sql + supabase/flat-lay-schema.sql first.
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
      : "No .env or .env.local found"
  );
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

function readJson(rel) {
  return JSON.parse(readFileSync(resolve(root, rel), "utf8"));
}

async function upsertChunks(table, rows, size = 80) {
  if (!rows.length) {
    console.log(`  ${table}: 0 rows`);
    return;
  }
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { error } = await supabase.from(table).upsert(chunk);
    if (error) {
      console.error(`Failed upserting ${table}:`, error.message);
      throw error;
    }
    console.log(`  ${table}: ${Math.min(i + size, rows.length)}/${rows.length}`);
  }
}

async function clearByIdColumn(table, idColumn = "id") {
  const { data, error } = await supabase.from(table).select(idColumn);
  if (error) throw error;
  const ids = (data || []).map((r) => r[idColumn]).filter(Boolean);
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { error: delErr } = await supabase
      .from(table)
      .delete()
      .in(idColumn, chunk);
    if (delErr) throw delErr;
  }
}

/** Map flat-lay expectedClientIds → board catalog labels (match legacy pins.json). */
const CLIENT_ID_LABELS = {
  streetwear_drop: "Streetwear / Drop",
  boutique_ethnic: "Boutique / Ethnic Wear",
  d2c_shopify: "D2C / Shopify",
  app_startup: "App Startup",
  saas_software: "SaaS / Software",
  restaurant_cafe: "Restaurant / Cafe",
  gym_fitness: "Gym / Fitness",
  salon_beauty: "Salon / Beauty",
  clinic_healthcare: "Clinic / Healthcare",
  education_course: "Education / Course",
  high_ticket_coach: "High-Ticket Coach",
  real_estate: "Real Estate",
  interior_architect: "Interior / Architect",
  jewelry_brand: "Jewelry Brand",
  fmcg_packaged_food: "FMCG / Packaged Food",
  personal_brand: "Personal Brand",
  home_decor_furniture: "Home Decor / Furniture",
  b2b_manufacturer: "B2B Manufacturer",
  gadget_electronics: "Gadget / Electronics",
  luxury_local_brand: "Luxury Local Brand",
  local_retail_store: "Local Retail Store",
  doctor_medical_brand: "Doctor / Medical Brand",
  school_preschool: "School / Preschool",
  franchise_brand: "Franchise Brand",
  finance_insurance_loan: "Finance / Insurance / Loan",
};

function clientLabel(id) {
  return CLIENT_ID_LABELS[id] || humanizeId(id);
}

function humanizeId(id) {
  return String(id || "")
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function mapStatus(status, { forceActive = false } = {}) {
  if (forceActive) return "Active";
  const s = String(status || "").toLowerCase();
  if (s.includes("publish") || s === "active") return "Active";
  if (s.includes("archiv")) return "Archived";
  return "Draft";
}

function letters() {
  return "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
}

async function main() {
  const parentData = readJson("data/flat_lay_parent_pins.json");
  const childData = readJson("data/flat_lay_child_pins.json");
  const packsData = readJson("data/flat_lay_client_packs.json");
  const commerceData = readJson("data/flat_lay_commerce_builds.json");
  const brandformance = readJson("data/flat_lay_brandformance.json");
  const brandRecall = readJson("data/flat_lay_brand_recall.json");

  console.log("Seeding flat_problems…");
  await upsertChunks(
    "flat_problems",
    (parentData.problemDefinitions || []).map((p) => ({
      id: p.id,
      customer_statement: p.customerStatement,
      system_meaning: p.systemMeaning || "",
    }))
  );

  console.log("Seeding flat_parent_groups…");
  await upsertChunks(
    "flat_parent_groups",
    (parentData.parentGroups || []).map((g) => ({
      id: g.id,
      label: g.label,
    }))
  );

  console.log("Seeding flat_output_types…");
  await upsertChunks(
    "flat_output_types",
    (childData.outputTypes || []).map((o) => ({
      id: o.id,
      label: o.label,
    }))
  );

  console.log("Seeding flat_parent_pins…");
  await upsertChunks(
    "flat_parent_pins",
    (parentData.parents || []).map((p) => ({
      id: p.id,
      name: p.name,
      parent_group_id: p.parentGroup,
      description: p.description || "",
      problem_ids: p.problemIds || [],
      is_parent: p.isParent !== false,
      medium_independent: p.mediumIndependent !== false,
      status: p.status || "draft_for_review",
    }))
  );

  console.log("Seeding flat_child_pins…");
  await upsertChunks(
    "flat_child_pins",
    (childData.children || []).map((c) => ({
      id: c.id,
      parent_id: c.parentId,
      output_type: c.outputType,
      label: c.label,
      available: c.available !== false,
      default_selected: !!c.defaultSelected,
      status: c.status || "draft_for_review",
    }))
  );

  console.log("Seeding flat_commerce_builds…");
  await upsertChunks(
    "flat_commerce_builds",
    (commerceData.commerceBuilds || []).map((b) => ({
      id: b.id,
      name: b.name,
      platform_group: b.platformGroup || "",
      build_type: b.buildType || "",
      migrated_from_pack_ids: b.migratedFromPackIds || [],
      entry_statements: b.entryStatements || [],
      problem_ids: b.problemIds || [],
      parent_ids: b.parentIds || [],
      child_ids: b.childIds || [],
      deliverables: b.deliverables || [],
      catalog_references: b.catalogReferences || [],
      editable: b.editable !== false,
      status: b.status || "draft_for_review",
    }))
  );

  console.log("Seeding flat_campaign_modes…");
  const modes = [brandformance, brandRecall];
  await upsertChunks(
    "flat_campaign_modes",
    modes.map((m) => {
      const {
        id,
        schemaVersion,
        name,
        customerFacingName,
        description,
        primaryGoal,
        status,
        ...rest
      } = m;
      return {
        id,
        schema_version: schemaVersion || "flat-lay-campaign-mode-v1",
        name,
        customer_facing_name: customerFacingName || "",
        description: description || "",
        primary_goal: primaryGoal || "",
        status: status || "draft_for_review",
        body: rest,
      };
    })
  );

  console.log("Seeding flat_client_packs…");
  const packs = packsData.clientPacks || [];
  await upsertChunks(
    "flat_client_packs",
    packs.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category || "",
      client_group: p.clientGroup || "",
      expected_client_ids: p.expectedClientIds || [],
      entry_statements: p.entryStatements || [],
      problem_ids: p.problemIds || [],
      default_campaign_mode: p.defaultCampaignMode || "hybrid",
      allowed_campaign_modes: p.allowedCampaignModes || [],
      standalone_web_solutions: p.standaloneWebSolutions || [],
      automation_solutions: p.automationSolutions || [],
      commerce_build_refs: p.commerceBuildRefs || [],
      creative_parent_count: p.creativeParentCount || 0,
      creative_child_count: p.creativeChildCount || 0,
      editable: p.editable !== false,
      status: p.status || "draft_for_review",
    }))
  );

  console.log("Refreshing flat_client_pack_selections…");
  await clearByIdColumn("flat_client_pack_selections");
  const selectionRows = [];
  for (const p of packs) {
    for (const sel of p.creativeSelections || []) {
      selectionRows.push({
        pack_id: p.id,
        parent_id: sel.parentId,
        child_ids: sel.childIds || [],
        level: sel.level || "required",
      });
    }
  }
  await upsertChunks("flat_client_pack_selections", selectionRows);

  // ── Materialize board projection ───────────────────────────
  // Board Parent only: do not project child / automation pins into `pins`.
  // Other boards (formats, clients, creative packs, sell channels, problems)
  // stay empty of pin rows until those surfaces are rebuilt.
  console.log("Materializing problems / catalogs / parent pins for boards…");

  const packNameList = packs.map((p) => p.name);

  const allClientLabels = [
    ...new Set(
      packs.flatMap((p) => (p.expectedClientIds || []).map(clientLabel))
    ),
  ].sort();

  const problemDefs = parentData.problemDefinitions || [];
  const letterList = letters();
  const problemRows = problemDefs.map((p, i) => ({
    id: p.id,
    title: p.customerStatement,
    label: p.systemMeaning || p.id,
    letter: letterList[i] || String(i + 1),
    expected_client: [],
  }));

  const catalogRows = [
    { key: "expectedClients", options: allClientLabels },
    {
      key: "sellingOptions",
      options: [
        "Self",
        "Online",
        "Amazon",
        "App Store",
        "Website",
        "Marketplace",
        "Social",
        "Retail",
        "WhatsApp",
        "Offline Store",
      ],
    },
    { key: "creativePackOptions", options: packNameList },
    {
      key: "fullCampaignOptions",
      options: modes.map((m) => m.name),
    },
    {
      key: "talentOptions",
      options: [
        "Founder",
        "Creator",
        "Model",
        "Customer / UGC",
        "No Talent",
      ],
    },
  ];

  const pinRows = [];

  for (const parent of parentData.parents || []) {
    pinRows.push({
      id: parent.id,
      name: parent.name,
      subtype: "Parent",
      branch: "Ads",
      column: "videos",
      price: "₹0",
      lower: "₹0",
      higher: "₹0",
      PM: false,
      status: mapStatus(parent.status, { forceActive: true }),
      tags: [],
      display_tags: [],
      notes: "",
      expected_client: [],
      selling: [],
      creative_pack: [],
      full_campaign: [],
      talent: [],
      problems: [],
      hooks: 0,
      angles: 0,
      executions: 0,
      assets: 0,
      format_assets: {},
      format_packs: {},
      stage: 1,
      footer_label: parent.parentGroupLabel || "Parent",
    });
  }

  // Replace board projection cleanly (new DB / full refresh)
  console.log("  clearing board projection tables…");
  await clearByIdColumn("pins");
  await clearByIdColumn("problems");
  await clearByIdColumn("catalogs", "key");

  await upsertChunks("problems", problemRows);
  await upsertChunks("catalogs", catalogRows);
  await upsertChunks("pins", pinRows, 50);

  console.log("Done.");
  console.log(
    `  flat-lay: ${parentData.parents?.length || 0} parents, ${childData.children?.length || 0} children (canonical only), ${packs.length} packs, ${commerceData.commerceBuilds?.length || 0} commerce, ${modes.length} campaign modes`
  );
  console.log(
    `  boards:   ${pinRows.length} parent pins only, ${problemRows.length} problems, ${catalogRows.length} catalogs`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

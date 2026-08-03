import type { BoardId } from "@/features/pins/types";

export const BOARD_NAV: {
  href: string;
  label: string;
  icon: string;
  id: BoardId;
}[] = [
  { href: "/boards/catalog", label: "Board Parent", icon: "▣", id: "catalog" },
  { href: "/boards/formats", label: "Board Child", icon: "▦", id: "formats" },
  { href: "/boards/clients", label: "Expected Client", icon: "◫", id: "clients" },
  { href: "/boards/sell-channels", label: "Sell Channels", icon: "⇄", id: "sell-channels" },
  { href: "/boards/creative-packs", label: "Creative Pack", icon: "◈", id: "creative-packs" },
  { href: "/boards/problems", label: "Problems", icon: "☰", id: "problems" },
];

/** Branch columns used by problems / tag coverage matrices (matches legacy shared.js). */
export const MATRIX_BRANCH_COLS = [
  { id: "Ads", title: "Ads", thClass: "th-ads" },
  { id: "Web", title: "Web", thClass: "th-web" },
  { id: "Automation", title: "Automation", thClass: "th-auto" },
] as const;

export const MATRIX_PARENT_COL = {
  id: "__parent__",
  title: "Board Parent",
  thClass: "th-parent",
} as const;

/** Unassigned kanban column id on Client / Sell / Creative boards. */
export const UNASSIGNED_COL_ID = "__unassigned__";

/** A, B, … Z, AA — matches legacy matrixLetterFor. */
export function matrixLetterFor(index: number) {
  let n = index;
  let letter = "";
  while (n >= 0) {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

export const BOARD_USER_CHIPS: Partial<Record<BoardId, string>> = {
  catalog: "Bhavni",
  formats: "Barani",
  clients: "Bhavni",
  "sell-channels": "Bhavni",
  "creative-packs": "Bhavni",
  problems: "Bhavni",
};

export const CLIENT_DISPLAY_LABELS: Record<string, string> = {
  "Streetwear / Drop": "Clothing / Streetwear",
  "Boutique / Ethnic Wear": "Boutique / Ethnic Wear",
  "Amazon Seller": "Amazon / Marketplace Seller",
  "D2C / Shopify": "D2C / Shopify Brand",
  "Ad Fatigue Refresh": "Existing Brand — Ads",
  "Meta Ad Kit": "Meta-First Brand",
  "App Startup": "App / Mobile Startup",
  "SaaS / Software": "SaaS / Software Tool",
  "Restaurant / Cafe": "Restaurant / Cafe",
  "Cloud Kitchen": "Cloud Kitchen",
  "Gym / Fitness": "Gym / Fitness Studio",
  "Salon / Beauty": "Salon / Beauty Studio",
  "Clinic / Healthcare": "Clinic / Healthcare",
  "Education / Course": "Education / Course Creator",
  "High-Ticket Coach": "High-Ticket Coach",
  "Real Estate": "Real Estate Developer",
  "Interior / Architect": "Interior Designer",
  "Jewelry Brand": "Jewelry / Accessories",
  "FMCG / Packaged Food": "FMCG / Packaged Food",
  "Personal Brand": "Personal Brand / Expert",
  "Event / Workshop": "Event / Workshop",
  "New Store Launch": "New Store / Location",
  "Home Decor / Furniture": "Home Decor / Furniture",
  "B2B Manufacturer": "B2B / Industrial Manufacturer",
  "Hiring / Employer": "Company / HR Team",
  "Wedding / Event Decor": "Wedding Planner",
  "Travel / Resort": "Travel / Resort",
  "Car / Auto Dealer": "Car / Auto Dealer",
  "Gadget / Electronics": "Gadget / Electronics",
  "Luxury Local Brand": "Luxury Local Brand",
  "Local Retail Store": "Local Retail Store",
  "Doctor / Medical Brand": "Doctor / Medical Brand",
  "School / Preschool": "School / Preschool",
  "Franchise Brand": "Franchise Brand",
  "Finance / Insurance / Loan": "Finance / Insurance / Loan",
};

export const DEFAULT_TALENT_OPTIONS = [
  "Founder",
  "Creator",
  "Model",
  "Customer / UGC",
  "No Talent",
];

export const FORMAT_COLUMNS = [
  { id: "all", title: "ALL PINS", expandable: false, directory: true },
  { id: "draft", title: "DRAFT / IDEAS", expandable: true, directory: false },
  { id: "videos", title: "VIDEO PINS", expandable: true, directory: false },
  { id: "images", title: "IMAGE PINS", expandable: true, directory: false },
  { id: "print", title: "PRINT PINS", expandable: true, directory: false },
  { id: "web", title: "WEB PINS", expandable: true, directory: false },
  { id: "automation", title: "AUTOMATION PINS", expandable: true, directory: false },
  { id: "archived", title: "ARCHIVED", expandable: true, directory: false },
] as const;

export const BRANCHES = ["Ads", "Print", "Web", "Online Selling", "Automation"] as const;

/** Format-column branch chips used on Child / Client / Sell / Creative (legacy renderBranchChips). */
export const FORMAT_BRANCH_CHIPS = [
  { id: "videos", label: "Videos", color: "var(--col-video)" },
  { id: "images", label: "Images", color: "var(--col-image)" },
  { id: "print", label: "Print", color: "var(--col-print)" },
  { id: "web", label: "Web", color: "var(--col-web)" },
  { id: "automation", label: "Automation", color: "var(--col-auto)" },
] as const;

export type FilterRowKey =
  | "expectedClient"
  | "selling"
  | "creativePack"
  | "fullCampaign"
  | "pinNames"
  | "branch";

/** Per-board filter rows — mirrors each board-*.html filters panel. */
export const BOARD_FILTER_ROWS: Record<
  BoardId,
  { key: FilterRowKey; label: string }[]
> = {
  catalog: [
    { key: "expectedClient", label: "Expected Client" },
    { key: "selling", label: "Selling" },
    { key: "creativePack", label: "Creative Pack" },
    { key: "fullCampaign", label: "Full Campaign" },
  ],
  formats: [
    { key: "pinNames", label: "All Pins" },
    { key: "expectedClient", label: "Expected Client" },
    { key: "branch", label: "Branch" },
  ],
  clients: [
    { key: "expectedClient", label: "Client Boards" },
    { key: "branch", label: "Branch" },
  ],
  "sell-channels": [
    { key: "selling", label: "Sell Channels" },
    { key: "branch", label: "Branch" },
  ],
  "creative-packs": [
    { key: "creativePack", label: "Creative Packs" },
    { key: "branch", label: "Branch" },
  ],
  problems: [{ key: "expectedClient", label: "Expected Client" }],
};

export const PINS_STORAGE_KEY = "oas-pins-data-v2";
export const PROBLEMS_STORAGE_KEY = "oas-problems-data-v2";

/** Boards that edit format packs / multi-output assets instead of raw metrics. */
export function usesFormatPackEditor(boardId: BoardId) {
  return (
    boardId === "catalog" ||
    boardId === "clients" ||
    boardId === "sell-channels" ||
    boardId === "creative-packs"
  );
}

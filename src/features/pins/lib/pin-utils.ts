import type {
  BoardId,
  FormatKey,
  NormalizedStatus,
  Pin,
  PinBranch,
  PinColumn,
} from "@/features/pins/types";
import type { PinFilterState } from "@/features/pins/lib/filters";

/** Flat-lay parent concept row (Board Parent). Children use `{parentId}__{output}`. */
export function isParentPin(pin: Pick<Pin, "subtype"> | null | undefined) {
  return String(pin?.subtype || "").toLowerCase() === "parent";
}

/** Scope pins to a board so parent ids only appear on Board Parent (catalog). */
export function pinsForBoard(boardId: BoardId, pins: Pin[]): Pin[] {
  if (boardId === "catalog") return pins.filter(isParentPin);
  return pins.filter((p) => !isParentPin(p));
}

export function normalizedStatus(pin: Pick<Pin, "status"> | null | undefined): NormalizedStatus {
  const status = String(pin?.status || "").toLowerCase();
  if (status === "draft") return "Draft";
  if (status === "archived") return "Archived";
  return "Active";
}

export function isDraft(pin: Pin) {
  return normalizedStatus(pin) === "Draft";
}

export function isArchived(pin: Pin) {
  return normalizedStatus(pin) === "Archived";
}

export function isActive(pin: Pin) {
  return normalizedStatus(pin) === "Active";
}

export function columnToFormatKey(column: string | undefined): FormatKey {
  if (column === "images") return "image";
  if (column === "print") return "print";
  if (column === "web") return "web";
  if (column === "automation") return "automation";
  return "video";
}

export function columnDisplayName(column: string | undefined) {
  const map: Record<string, string> = {
    videos: "Videos",
    images: "Images",
    print: "Print",
    web: "Web",
    automation: "Automation",
  };
  return map[column || ""] || "";
}

export function formatAssetCounts(pin: Pin) {
  const counts: Record<FormatKey, number> = {
    video: 0,
    image: 0,
    print: 0,
    web: 0,
    automation: 0,
  };
  const stored = pin.formatAssets;
  if (stored && typeof stored === "object") {
    (Object.keys(counts) as FormatKey[]).forEach((key) => {
      const entry = stored[key];
      if (entry == null) return;
      counts[key] = typeof entry === "number" ? Number(entry) || 0 : Number(entry.assets) || 0;
    });
    return counts;
  }
  const key = columnToFormatKey(pin.column);
  counts[key] = Number(pin.assets) || 0;
  return counts;
}

export function primaryFormatKey(column: string | undefined): FormatKey {
  return columnToFormatKey(column);
}

const FORMAT_COLUMN: Record<FormatKey, PinColumn> = {
  video: "videos",
  image: "images",
  print: "print",
  web: "web",
  automation: "automation",
};

const FORMAT_SUBTYPE: Record<FormatKey, string> = {
  video: "Video",
  image: "Images",
  print: "Flyer",
  web: "Landing Page",
  automation: "Automation",
};

const FORMAT_BRANCH: Record<FormatKey, PinBranch | string> = {
  video: "Ads",
  image: "Ads",
  print: "Print",
  web: "Web",
  automation: "Automation",
};

/** Child pin id for a parent format variation (`relatable_situation__video`). */
export function formatChildPinId(parentId: string, format: FormatKey) {
  return `${parentId}__${format}`;
}

export function isFormatChildPinId(id: string, parentId: string) {
  return id.startsWith(`${parentId}__`);
}

/** Project selected output formats onto Board Child (+ tagged boards via copied tags). */
export function buildFormatChildPins(parent: Pin, formats: FormatKey[]): Pin[] {
  return formats.map((format) => {
    const pack = parent.formatPacks?.[format];
    const fa = parent.formatAssets?.[format];
    const assets =
      Number(pack?.assets) ||
      (typeof fa === "number" ? fa : Number(fa?.assets)) ||
      0;
    const hooks = Number(pack?.hooks) || 0;
    const angles = Number(pack?.angles) || 0;
    const executions = Number(pack?.executions) || 0;
    const subtype = FORMAT_SUBTYPE[format];
    const column = FORMAT_COLUMN[format];
    return {
      id: formatChildPinId(parent.id, format),
      name: `${parent.name} — ${subtype}`,
      subtype,
      branch: FORMAT_BRANCH[format],
      column,
      price: parent.price,
      lower: parent.lower,
      higher: parent.higher,
      PM: parent.PM,
      status: parent.status,
      tags: [subtype],
      displayTags: [subtype.toUpperCase()],
      notes: parent.notes || "",
      expectedClient: [...(parent.expectedClient || [])],
      selling: [...(parent.selling || [])],
      creativePack: [...(parent.creativePack || [])],
      fullCampaign: [...(parent.fullCampaign || [])],
      talent: [...(parent.talent || [])],
      problems: [...(parent.problems || [])],
      hooks,
      angles,
      executions,
      assets,
      formatAssets: {},
      formatPacks: {},
      stage: parent.stage || 1,
      footerLabel: subtype,
    };
  });
}

export function buildPinId(pins: Pin[], column: string) {
  const prefixMap: Record<string, string> = {
    videos: "VV",
    images: "AI",
    print: "PT",
    web: "WB",
    automation: "AU",
  };
  const prefix = prefixMap[column] || "PN";
  const used = new Set(pins.map((p) => p.id));
  let next = 1;
  while (used.has(prefix + next)) next += 1;
  return prefix + next;
}

export type CreateDraftOptions = {
  column?: string;
  subtype?: string;
  status?: string;
  branch?: string;
  expectedClient?: string[];
  selling?: string[];
  creativePack?: string[];
  problems?: string[];
};

export function createDraftPin(pins: Pin[], options?: CreateDraftOptions): Pin {
  const column = options?.column || "videos";
  const realColumn = (column === "draft" ? "videos" : column) as PinColumn;
  const isParent = String(options?.subtype || "").toLowerCase() === "parent";
  const subtype =
    options?.subtype ||
    (realColumn === "videos"
      ? "Video"
      : realColumn === "images"
        ? "Images"
        : realColumn === "print"
          ? "Flyer"
          : realColumn === "automation"
            ? "Email / Automation"
            : "Landing Page");
  const status = options?.status || (column === "draft" ? "Draft" : "Published");
  const branch =
    options?.branch ||
    (isParent
      ? "Ads"
      : realColumn === "print"
        ? "Print"
        : realColumn === "web"
          ? "Web"
          : realColumn === "automation"
            ? "Automation"
            : "Ads");

  return {
    id: buildPinId(pins, realColumn),
    name: "Untitled Pin",
    subtype,
    branch,
    column: realColumn,
    price: "₹0",
    lower: "₹0",
    higher: "₹0",
    PM: false,
    status,
    tags: isParent ? ["Parent"] : [subtype],
    displayTags: isParent ? ["PARENT"] : [subtype.toUpperCase()],
    notes: "",
    expectedClient: options?.expectedClient || [],
    selling: options?.selling || [],
    creativePack: options?.creativePack || [],
    fullCampaign: [],
    talent: [],
    problems: options?.problems || [],
    hooks: 0,
    angles: 0,
    executions: 0,
    assets: 0,
    formatAssets: { video: 0, image: 0, print: 0, web: 0, automation: 0 },
    formatPacks: {},
    stage: 1,
    footerLabel: isParent ? "Parent" : subtype,
  };
}

export function duplicatePin(pins: Pin[], pin: Pin, format?: string): Pin {
  const clone: Pin = structuredClone(pin);
  if (format) {
    const key = format.toLowerCase();
    const map: Record<string, PinColumn> = {
      video: "videos",
      videos: "videos",
      image: "images",
      images: "images",
      print: "print",
      web: "web",
      automation: "automation",
      online: "automation",
    };
    clone.column = map[key] || (key as PinColumn);
    clone.subtype =
      clone.column === "videos"
        ? "Video"
        : clone.column === "images"
          ? "Images"
          : clone.column === "print"
            ? "Flyer"
            : clone.column === "automation"
              ? "Email / Automation"
              : "Landing Page";
    clone.footerLabel = clone.subtype;
  }
  clone.id = buildPinId(pins, String(clone.column));
  clone.status = "Draft";
  clone.PM = false;
  return clone;
}

export function pinMatchesQuery(pin: Pin, query: string) {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  const hay = [
    pin.id,
    pin.name,
    pin.subtype,
    pin.branch,
    pin.price,
    ...(pin.tags || []),
    ...(pin.displayTags || []),
    ...(pin.expectedClient || []),
    ...(pin.selling || []),
    ...(pin.creativePack || []),
    ...(pin.fullCampaign || []),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function pinMatchesFilters(pin: Pin, filters: PinFilterState) {
  const matchSet = (selected: Set<string>, values: string[] | undefined) => {
    if (!selected.size) return true;
    const list = values || [];
    return [...selected].some((v) => list.includes(v));
  };
  if (filters.pinNames.size && !filters.pinNames.has(pin.name)) return false;
  return (
    matchSet(filters.expectedClient, pin.expectedClient) &&
    matchSet(filters.selling, pin.selling) &&
    matchSet(filters.creativePack, pin.creativePack) &&
    matchSet(filters.fullCampaign, pin.fullCampaign)
  );
}

function escapeHtml(text: string) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Default notes markdown when pin.notes is empty — matches view2.js openPanel. */
export function defaultPinNotesMarkdown(pin: Pick<Pin, "name" | "branch" | "subtype" | "tags">) {
  return [
    `- **Goal:** ${pin.name}`,
    `- **Branch:** ${pin.branch || ""} / ${pin.subtype || ""}`,
    `- **Best use:** ${(pin.tags || []).join(", ")}`,
    "- **Edit note:** Add hooks, deliverables, CTA, exclusions, and owner update here.",
  ].join("\n");
}

/** Resolve notes for the detail drawer (stored notes or legacy default template). */
export function resolvePinNotesMarkdown(pin: Pick<Pin, "name" | "branch" | "subtype" | "tags" | "notes">) {
  const raw = String(pin.notes || "").trim();
  return raw || defaultPinNotesMarkdown(pin);
}

/** Legacy shared.js renderMarkdown — used by notes preview. */
export function renderNotesMarkdown(src: string) {
  const lines = String(src || "").replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let inList = false;
  const inline = (text: string) =>
    escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
  const closeList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };
  lines.forEach((line) => {
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>`;
      return;
    }
    closeList();
    if (line.trim() === "") return;
    html += `<p>${inline(line)}</p>`;
  });
  closeList();
  return html || "<p><em>Empty notes</em></p>";
}

/** Flat-lay default notes HTML when pin.notes is empty — matches shared.js defaultFlatNotes. */
export function defaultFlatNotesHtml(pin: Pick<Pin, "branch" | "subtype" | "tags">) {
  const tags = (pin.tags || []).slice(0, 3).join(", ") || "—";
  return (
    "<ul>" +
    "<li><strong>Goal:</strong> Create a clean creative asset that makes the audience react.</li>" +
    `<li><strong>Branch:</strong> ${escapeHtml((pin.branch || "—") + " / " + (pin.subtype || "—"))}</li>` +
    `<li><strong>Best use:</strong> ${escapeHtml(tags)}</li>` +
    "<li><strong>Edit note:</strong> Add hooks, deliverables, CTA, exclusions, and owner update here.</li>" +
    "</ul>"
  );
}

/** Flat-lay notes body — stored markdown or legacy defaultFlatNotes. */
export function resolveFlatNotesHtml(pin: Pick<Pin, "branch" | "subtype" | "tags" | "notes">) {
  const raw = String(pin.notes || "").trim();
  return raw ? renderNotesMarkdown(raw) : defaultFlatNotesHtml(pin);
}

import type { Pin } from "@/features/pins/types";
import type { FormatColumnId, OnboardingDiagnosis } from "../types";

const ONLINE_SELLING = new Set([
  "Online",
  "Amazon",
  "App Store",
  "Marketplace",
  "Website",
  "Self",
]);

/** Soft cap so Recommend never dumps the entire catalog into the shortlist. */
const RECOMMEND_CAP = 48;

export function pinFormatColumn(pin: Pin): FormatColumnId {
  const selling = pin.selling || [];
  if (selling.some((s) => ONLINE_SELLING.has(s))) return "online_selling";

  const col = String(pin.column || "").toLowerCase();
  if (col === "videos" || col === "video") return "videos";
  if (col === "images" || col === "image") return "images";
  if (col === "print") return "print";
  if (col === "web") return "web";
  if (col === "automation") return "automation";

  const branch = String(pin.branch || "").toLowerCase();
  if (branch.includes("online")) return "online_selling";
  if (branch.includes("automat")) return "automation";
  if (branch.includes("print")) return "print";
  if (branch.includes("web")) return "web";
  if (branch.includes("ad")) return "videos";

  return "videos";
}

const CHANNEL_TO_COLUMN: Record<string, FormatColumnId | null> = {
  "All formats": null,
  "Video Ads": "videos",
  "Image Ads": "images",
  Print: "print",
  Web: "web",
  "Online Selling": "online_selling",
  Automation: "automation",
};

function matchesGoal(pin: Pin, goal: string | null): boolean {
  if (!goal) return true;
  const packs = pin.creativePack || [];
  // Untagged pins stay eligible — most catalog pins have empty creativePack.
  if (packs.length === 0) return true;
  return packs.includes(goal);
}

function matchesExpected(pin: Pin, expected: string | null): boolean {
  if (!expected) return true;
  const clients = pin.expectedClient || [];
  if (clients.length === 0) return true;
  return clients.includes(expected);
}

function matchesChannel(pin: Pin, channelCol: FormatColumnId | null): boolean {
  if (!channelCol) return true;
  return pinFormatColumn(pin) === channelCol;
}

function matchesProblems(pin: Pin, problemIds: Set<string>): boolean {
  if (problemIds.size === 0) return true;
  const pp = pin.problems || [];
  if (pp.length === 0) return false;
  return pp.some((id) => problemIds.has(id));
}

function scorePin(
  pin: Pin,
  problemIds: Set<string>,
  goal: string | null,
  expected: string | null
): number {
  let score = 0;
  const pp = pin.problems || [];
  if (problemIds.size > 0 && pp.some((id) => problemIds.has(id))) score += 8;
  if (goal && (pin.creativePack || []).includes(goal)) score += 4;
  if (expected && (pin.expectedClient || []).includes(expected)) score += 6;
  return score;
}

/** Prefer higher scores; keep format diversity when capping. */
function rankAndCap(
  pins: Pin[],
  problemIds: Set<string>,
  goal: string | null,
  expected: string | null,
  cap = RECOMMEND_CAP
): Pin[] {
  if (pins.length <= cap) {
    return [...pins].sort(
      (a, b) => scorePin(b, problemIds, goal, expected) - scorePin(a, problemIds, goal, expected)
    );
  }

  const sorted = [...pins].sort(
    (a, b) => scorePin(b, problemIds, goal, expected) - scorePin(a, problemIds, goal, expected)
  );

  const picked: Pin[] = [];
  const perFormat = new Map<FormatColumnId, number>();
  const maxPerFormat = Math.max(4, Math.ceil(cap / 6));

  for (const pin of sorted) {
    if (picked.length >= cap) break;
    const col = pinFormatColumn(pin);
    const n = perFormat.get(col) || 0;
    if (n >= maxPerFormat) continue;
    picked.push(pin);
    perFormat.set(col, n + 1);
  }

  // Fill remaining slots if format caps left gaps.
  if (picked.length < cap) {
    const seen = new Set(picked.map((p) => p.id));
    for (const pin of sorted) {
      if (picked.length >= cap) break;
      if (seen.has(pin.id)) continue;
      picked.push(pin);
    }
  }

  return picked;
}

/** Map manual diagnosis → matching catalog pins. */
export function recommendPinsFromDiagnosis(
  pins: Pin[],
  diagnosis: OnboardingDiagnosis
): Pin[] {
  const problemIds = new Set(diagnosis.problemIds || []);
  const goal = diagnosis.goal?.trim() || null;
  const expected = diagnosis.expectedClient?.trim() || null;
  const channelCol = CHANNEL_TO_COLUMN[diagnosis.channel || "All formats"] ?? null;

  let results = pins.filter(
    (p) =>
      matchesProblems(p, problemIds) &&
      matchesGoal(p, goal) &&
      matchesExpected(p, expected) &&
      matchesChannel(p, channelCol)
  );

  // Catalog pins often have no `problems` tags. When the strict problem match
  // yields nothing, fall back to goal / expected-client / channel so Recommend
  // still returns useful pins.
  if (results.length === 0 && problemIds.size > 0) {
    results = pins.filter(
      (p) => matchesGoal(p, goal) && matchesExpected(p, expected) && matchesChannel(p, channelCol)
    );
  }

  // If goal/expected still over-filtered (e.g. sparse creativePack tags), relax
  // to expected + channel, then channel-only.
  if (results.length === 0 && (goal || expected || channelCol)) {
    results = pins.filter((p) => matchesExpected(p, expected) && matchesChannel(p, channelCol));
  }

  if (results.length === 0 && channelCol) {
    results = pins.filter((p) => matchesChannel(p, channelCol));
  }

  return rankAndCap(results, problemIds, goal, expected);
}

export function pinsForExpectedClient(pins: Pin[], expectedClient: string): Pin[] {
  return pins.filter((p) => (p.expectedClient || []).includes(expectedClient));
}

export function groupPinsByFormat(pins: Pin[]): Record<FormatColumnId, Pin[]> {
  const groups: Record<FormatColumnId, Pin[]> = {
    videos: [],
    images: [],
    print: [],
    web: [],
    online_selling: [],
    automation: [],
  };
  for (const pin of pins) {
    groups[pinFormatColumn(pin)].push(pin);
  }
  return groups;
}

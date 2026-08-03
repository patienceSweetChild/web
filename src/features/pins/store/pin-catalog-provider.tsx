"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import seedPins from "@/data/pins.json";
import seedProblems from "@/data/problems.json";
import { DEFAULT_TALENT_OPTIONS, PINS_STORAGE_KEY, PROBLEMS_STORAGE_KEY } from "@/features/boards/config";
import {
  createClient,
  fetchAllFromSupabase,
  isSupabaseConfigured,
  pinToDbPin,
  problemToDb,
} from "@/lib/supabase/client";
import type { BoardId, Catalogs, Pin, Problem } from "@/features/pins/types";

export type PinCatalogContextValue = {
  ready: boolean;
  backend: "local" | "supabase";
  pins: Pin[];
  problems: Problem[];
  catalogs: Catalogs;
  upsertPin: (pin: Pin, opts?: { boardId?: BoardId }) => Promise<void>;
  deletePin: (id: string, opts?: { boardId?: BoardId }) => Promise<void>;
  upsertProblem: (problem: Problem, opts?: { boardId?: BoardId }) => Promise<void>;
  setCatalog: (key: keyof Catalogs, options: string[]) => Promise<void>;
  refresh: () => Promise<void>;
};

const PinCatalogContext = createContext<PinCatalogContextValue | null>(null);

function seedCatalogs(): Catalogs {
  const data = seedPins as {
    expectedClients: string[];
    sellingOptions: string[];
    creativePackOptions: string[];
    fullCampaignOptions: string[];
    talentOptions?: string[];
  };
  return {
    expectedClients: data.expectedClients || [],
    sellingOptions: data.sellingOptions || [],
    creativePackOptions: data.creativePackOptions || [],
    fullCampaignOptions: data.fullCampaignOptions || [],
    talentOptions: data.talentOptions || DEFAULT_TALENT_OPTIONS,
  };
}

/** Strip "Ad", "Ads", "Pack" suffixes from pin names and display tags (one-time data migration). */
function migratePin(p: Pin): Pin {
  const strip = (s: string) =>
    s.replace(/\s+Ads\b/g, "").replace(/\s+Ad\b/g, "").replace(/\s+Pack\b/g, "").trim();
  return {
    ...p,
    name: strip(p.name),
    displayTags: (p.displayTags || []).map(strip),
    footerLabel: strip(p.footerLabel || ""),
  };
}

function loadLocal(): { pins: Pin[]; problems: Problem[]; catalogs: Catalogs } {
  const catalogs = seedCatalogs();
  let pins = (seedPins as { pins: Pin[] }).pins.map((p) => ({
    ...p,
    talent: p.talent || [],
    problems: p.problems || [],
  }));
  let problems = (seedProblems as { problems: Problem[] }).problems.map((p) => ({
    ...p,
    expectedClient: p.expectedClient || [],
  }));

  try {
    const raw = localStorage.getItem(PINS_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved.pins)) {
        // Build a seed lookup so we can recover displayTags / tags if they were wiped
        const seedById = new Map(pins.map((p) => [p.id, p]));
        pins = saved.pins.map((p: Pin) => {
          const migrated = migratePin(p);
          if (!migrated.displayTags?.length) {
            const seed = seedById.get(migrated.id);
            if (seed?.displayTags?.length) migrated.displayTags = seed.displayTags;
          }
          if (!migrated.tags?.length) {
            const seed = seedById.get(migrated.id);
            if (seed?.tags?.length) migrated.tags = seed.tags;
          }
          return migrated;
        });
      }
      (Object.keys(catalogs) as (keyof Catalogs)[]).forEach((key) => {
        if (Array.isArray(saved[key])) catalogs[key] = saved[key];
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const raw = localStorage.getItem(PROBLEMS_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved.problems)) problems = saved.problems;
    }
  } catch {
    /* ignore */
  }

  // Remap any pin whose id looks like a name (old data used name as id).
  // A valid generated id matches /^[A-Z]{2}\d+$/ — anything else gets a new id.
  const usedIds = new Set<string>();
  const prefixMap: Record<string, string> = {
    videos: "VV",
    images: "AI",
    print: "PT",
    web: "WB",
    automation: "AU",
  };
  const counters: Record<string, number> = {};
  pins = pins.map((p) => {
    if (/^[A-Z]{2}\d+$/.test(p.id) && !usedIds.has(p.id)) {
      usedIds.add(p.id);
      return p;
    }
    // id is either a name-string or a collision — generate a fresh one
    const prefix = prefixMap[String(p.column)] || "PN";
    let n = (counters[prefix] || 1);
    while (usedIds.has(prefix + n)) n++;
    counters[prefix] = n + 1;
    usedIds.add(prefix + n);
    return { ...p, id: prefix + n };
  });

  // Deduplicate by id — last occurrence wins (most recently upserted)
  const seen = new Set<string>();
  pins = [...pins].reverse().filter((p) => (seen.has(p.id) ? false : seen.add(p.id))).reverse();

  return { pins, problems, catalogs };
}

function persistLocal(pins: Pin[], catalogs: Catalogs, problems: Problem[]) {
  try {
    localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify({ pins, ...catalogs }));
    localStorage.setItem(PROBLEMS_STORAGE_KEY, JSON.stringify({ problems }));
  } catch {
    /* ignore */
  }
}

export function PinCatalogProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [backend, setBackend] = useState<"local" | "supabase">("local");
  const [pins, setPins] = useState<Pin[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [catalogs, setCatalogs] = useState<Catalogs>(seedCatalogs());

  const refresh = useCallback(async () => {
    if (isSupabaseConfigured()) {
      try {
        const data = await fetchAllFromSupabase();
        if (data.pins.length || data.problems.length) {
          const seenIds = new Set<string>();
          const dedupedPins = [...data.pins].reverse().filter((p) => (seenIds.has(p.id) ? false : seenIds.add(p.id))).reverse();
          setPins(dedupedPins);
          setProblems(data.problems);
          setCatalogs({
            ...seedCatalogs(),
            ...data.catalogs,
            talentOptions: data.catalogs.talentOptions.length
              ? data.catalogs.talentOptions
              : DEFAULT_TALENT_OPTIONS,
          });
          setBackend("supabase");
          setReady(true);
          return;
        }
      } catch (err) {
        console.warn("Supabase load failed, falling back to local seed", err);
      }
    }
    const local = loadLocal();
    setPins(local.pins);
    setProblems(local.problems);
    setCatalogs(local.catalogs);
    setBackend("local");
    setReady(true);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void refresh();
    });
  }, [refresh]);

  const upsertPin = useCallback(
    async (pin: Pin, opts?: { boardId?: BoardId }) => {
      setPins((prev) => {
        const idx = prev.findIndex((p) => p.id === pin.id);
        const next = idx >= 0 ? prev.map((p, i) => (i === idx ? pin : p)) : [...prev, pin];
        if (backend === "local") persistLocal(next, catalogs, problems);
        return next;
      });
      if (backend === "supabase") {
        const boardId = opts?.boardId;
        if (!boardId) throw new Error("upsertPin: boardId is required when using Supabase");
        const supabase = createClient();
        const { error } = await supabase.rpc("upsert_pin_board", {
          p_board_id: boardId,
          pin: pinToDbPin(pin),
        });
        if (error) console.error(error);
      }
    },
    [backend, catalogs, problems]
  );

  const deletePin = useCallback(
    async (id: string, opts?: { boardId?: BoardId }) => {
      setPins((prev) => {
        const next = prev.filter((p) => p.id !== id);
        if (backend === "local") persistLocal(next, catalogs, problems);
        return next;
      });
      if (backend === "supabase") {
        const boardId = opts?.boardId;
        if (!boardId) throw new Error("deletePin: boardId is required when using Supabase");
        const supabase = createClient();
        const { error } = await supabase.rpc("delete_pin_board", {
          p_board_id: boardId,
          pin_id: id,
        });
        if (error) console.error(error);
      }
    },
    [backend, catalogs, problems]
  );

  const upsertProblem = useCallback(
    async (problem: Problem, opts?: { boardId?: BoardId }) => {
      setProblems((prev) => {
        const idx = prev.findIndex((p) => p.id === problem.id);
        const next =
          idx >= 0 ? prev.map((p, i) => (i === idx ? problem : p)) : [...prev, problem];
        if (backend === "local") persistLocal(pins, catalogs, next);
        return next;
      });
      if (backend === "supabase") {
        const boardId = opts?.boardId;
        if (!boardId) throw new Error("upsertProblem: boardId is required when using Supabase");
        const supabase = createClient();
        const { error } = await supabase.rpc("upsert_problem_board", {
          p_board_id: boardId,
          problem: problemToDb(problem),
        });
        if (error) console.error(error);
      }
    },
    [backend, catalogs, pins]
  );

  const setCatalog = useCallback(
    async (key: keyof Catalogs, options: string[]) => {
      setCatalogs((prev) => {
        const next = { ...prev, [key]: options };
        if (backend === "local") persistLocal(pins, next, problems);
        return next;
      });
      if (backend === "supabase") {
        const supabase = createClient();
        await supabase.from("catalogs").upsert({ key, options });
      }
    },
    [backend, pins, problems]
  );

  const value = useMemo(
    () => ({
      ready,
      backend,
      pins,
      problems,
      catalogs,
      upsertPin,
      deletePin,
      upsertProblem,
      setCatalog,
      refresh,
    }),
    [
      ready,
      backend,
      pins,
      problems,
      catalogs,
      upsertPin,
      deletePin,
      upsertProblem,
      setCatalog,
      refresh,
    ]
  );

  return <PinCatalogContext.Provider value={value}>{children}</PinCatalogContext.Provider>;
}

export function usePinCatalog() {
  const ctx = useContext(PinCatalogContext);
  if (!ctx) throw new Error("usePinCatalog must be used within PinCatalogProvider");
  return ctx;
}

/** @deprecated Prefer usePinCatalog */
export const usePins = usePinCatalog;
/** @deprecated Prefer PinCatalogProvider */
export const PinsProvider = PinCatalogProvider;

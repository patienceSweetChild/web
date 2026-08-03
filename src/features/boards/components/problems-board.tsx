"use client";

import { useMemo, useState } from "react";
import { BoardWorkspace } from "@/features/boards/components/board-workspace";
import { CoverageMatrix } from "@/features/boards/components/coverage-matrix";
import { PinAttachModal } from "@/features/boards/components/pin-attach-modal";
import { useBoardWorkspace } from "@/features/boards/hooks/use-board-workspace";
import { useEffectiveBoardPermissions } from "@/features/boards/hooks/use-effective-board-permissions";
import { MATRIX_PARENT_COL } from "@/features/boards/config";
import { usePinCatalog } from "@/features/pins/store/pin-catalog-provider";
import type { Pin, Problem } from "@/features/pins/types";

export function ProblemsBoard() {
  const workspace = useBoardWorkspace("problems");
  const { problems, upsertPin, upsertProblem, catalogs } = usePinCatalog();
  // Exclude parent ids — they live only on Board Parent.
  const pins = workspace.pins;
  const perms = useEffectiveBoardPermissions("problems");
  const [picker, setPicker] = useState<{
    mode: "pin" | "client";
    problemId: string;
    branchId: string;
  } | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const filteredProblems = useMemo(() => {
    const q = workspace.query.trim().toLowerCase();
    return problems.filter((problem) => {
      if (q) {
        const hay = [problem.title, problem.label, problem.id, ...(problem.expectedClient || [])]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (workspace.filters.expectedClient.size) {
        const clients = problem.expectedClient || [];
        if (![...workspace.filters.expectedClient].some((c) => clients.includes(c))) {
          return false;
        }
      }
      return true;
    });
  }, [problems, workspace.query, workspace.filters.expectedClient]);

  const pinsByRow = useMemo(() => {
    const map = new Map<string, Pin[]>();
    filteredProblems.forEach((pr) => map.set(pr.id, []));
    pins.forEach((pin) => {
      (pin.problems || []).forEach((id) => {
        if (!map.has(id)) return;
        map.get(id)!.push(pin);
      });
    });
    return map;
  }, [filteredProblems, pins]);

  const clientsByRow = useMemo(() => {
    const map = new Map<string, string[]>();
    filteredProblems.forEach((pr) => map.set(pr.id, pr.expectedClient || []));
    return map;
  }, [filteredProblems]);

  const pickerItems = useMemo(() => {
    if (!picker) return [];
    const q = pickerQuery.trim().toLowerCase();
    if (picker.mode === "client") {
      const tagged = new Set(
        problems.find((p) => p.id === picker.problemId)?.expectedClient || []
      );
      return catalogs.expectedClients
        .filter((c) => !tagged.has(c))
        .filter((c) => !q || c.toLowerCase().includes(q))
        .map((c) => ({ id: c, name: c, meta: "client-only" }));
    }
    const tagged = new Set(
      (pinsByRow.get(picker.problemId) || [])
        .filter(
          (p) =>
            picker.branchId === MATRIX_PARENT_COL.id || String(p.branch) === picker.branchId
        )
        .map((p) => p.id)
    );
    return pins
      .filter((p) => {
        if (picker.branchId !== MATRIX_PARENT_COL.id && String(p.branch) !== picker.branchId) {
          return false;
        }
        if (tagged.has(p.id)) return false;
        if (!q) return true;
        const hay = [p.id, p.name, p.subtype, ...(p.expectedClient || [])].join(" ").toLowerCase();
        return hay.includes(q);
      })
      .map((p) => ({ id: p.id, name: p.name }));
  }, [picker, pickerQuery, problems, catalogs.expectedClients, pins, pinsByRow]);

  async function attachPin(pinId: string) {
    if (!picker) return;
    if (!perms.can_edit) return;
    const pin = pins.find((p) => p.id === pinId);
    if (!pin) return;
    const list = new Set(pin.problems || []);
    list.add(picker.problemId);
    await upsertPin({ ...pin, problems: [...list] }, { boardId: "problems" });
    setPicker(null);
    setPickerQuery("");
  }

  async function attachClient(clientId: string) {
    if (!picker) return;
    if (!perms.can_edit) return;
    const problem = problems.find((p) => p.id === picker.problemId);
    if (!problem) return;
    const next = new Set(problem.expectedClient || []);
    next.add(clientId);
    await upsertProblem({ ...problem, expectedClient: [...next] }, { boardId: "problems" });
    setPicker(null);
    setPickerQuery("");
  }

  async function untagPin(pinId: string, problemId: string) {
    const pin = pins.find((p) => p.id === pinId);
    if (!pin) return;
    if (!perms.can_edit) return;
    await upsertPin({
      ...pin,
      problems: (pin.problems || []).filter((id) => id !== problemId),
    }, { boardId: "problems" });
  }

  async function untagClient(client: string, problemId: string) {
    const problem = problems.find((p) => p.id === problemId);
    if (!problem) return;
    if (!perms.can_edit) return;
    await upsertProblem({
      ...problem,
      expectedClient: (problem.expectedClient || []).filter((c) => c !== client),
    }, { boardId: "problems" });
  }

  async function addProblem() {
    if (!perms.can_create) return;
    const title = newTitle.trim();
    if (!title) return;
    const id = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    const letter = String.fromCharCode(65 + (problems.length % 26));
    const problem: Problem = {
      id,
      title,
      label: title.toUpperCase(),
      letter,
      expectedClient: [],
    };
    await upsertProblem(problem, { boardId: "problems" });
    setNewTitle("");
    setAdding(false);
  }

  return (
    <BoardWorkspace
      title="Problems"
      boardId="problems"
      workspace={workspace}
      searchPlaceholder="Search problems"
      resultLabel="problems"
      resultCount={filteredProblems.length}
      primaryLabel="+ Problem"
      onPrimaryAction={() => setAdding(true)}
      contentClassName="content content-problems"
      intro={
        <p className="problems-intro">
          Coverage by problem × branch. Every cell shows which Pins are tagged to that problem in
          that branch.
        </p>
      }
    >
      {/* Override result count display via a local count — filter bar uses workspace.filtered.
          Pass a patched result by setting resultLabel only; count uses filteredProblems length
          through a small trick: we re-render filter with custom count via intro + matrix. */}
      {adding ? (
        <div className="inline-add-row">
          <input
            className="search"
            placeholder="Problem title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button type="button" className="btn btn-primary" onClick={() => void addProblem()}>
            Add
          </button>
          <button type="button" className="btn" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </div>
      ) : null}

      <CoverageMatrix
        rowHeader="Problem"
        showClientColumn
        rows={filteredProblems.map((pr) => ({
          id: pr.id,
          letter: pr.letter,
          title: pr.title,
          subtitle: pr.label,
        }))}
        pinsByRow={pinsByRow}
        clientsByRow={clientsByRow}
        onOpenPin={(id) => {
          const pin = pins.find((p) => p.id === id);
          if (pin) workspace.openPin(pin);
        }}
        onUntagPin={(pinId, rowId) => void untagPin(pinId, rowId)}
        onAddExisting={(rowId, branchId) =>
          perms.can_edit ? setPicker({ mode: "pin", problemId: rowId, branchId }) : undefined
        }
        onAddClient={(rowId) =>
          perms.can_edit
            ? setPicker({ mode: "client", problemId: rowId, branchId: "__client__" })
            : undefined
        }
        onUntagClient={(client, rowId) => void untagClient(client, rowId)}
      />

      <PinAttachModal
        open={!!picker}
        title={picker?.mode === "client" ? "Add expected client" : "Add existing pin"}
        searchPlaceholder={
          picker?.mode === "client" ? "Search expected clients…" : "Search pins…"
        }
        query={pickerQuery}
        onQueryChange={setPickerQuery}
        items={pickerItems}
        emptyText={
          picker?.mode === "client"
            ? "No matching expected clients."
            : picker?.branchId === MATRIX_PARENT_COL.id
              ? "No matching pins."
              : "No matching pins in this branch."
        }
        onSelect={(id) =>
          picker?.mode === "client" ? void attachClient(id) : void attachPin(id)
        }
        onClose={() => {
          setPicker(null);
          setPickerQuery("");
        }}
      />
    </BoardWorkspace>
  );
}

"use client";

import { useMemo, useState } from "react";
import { BoardWorkspace } from "@/features/boards/components/board-workspace";
import { BulkRemoveBar } from "@/features/boards/components/bulk-remove-bar";
import { ConfirmRemoveModal } from "@/features/boards/components/confirm-remove-modal";
import { KanbanColumn } from "@/features/boards/components/kanban-column";
import { FlatLayView } from "@/features/boards/components/flat-lay-view";
import { useBoardWorkspace } from "@/features/boards/hooks/use-board-workspace";
import { usePinRemoval } from "@/features/boards/hooks/use-pin-removal";
import { FORMAT_COLUMNS } from "@/features/boards/config";
import { PinCard, PinDirectoryRow } from "@/features/pins/components/pin-card";
import { isActive, isArchived, isDraft } from "@/features/pins/lib/pin-utils";
import type { Pin } from "@/features/pins/types";
import { SearchAutocomplete } from "@/shared/ui";

export function FormatBoard() {
  const workspace = useBoardWorkspace("formats");
  const removal = usePinRemoval("formats", { mode: "archive" });
  const [branchFilter, setBranchFilter] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [flatLay, setFlatLay] = useState<string | null>(null);
  const [dirQuery, setDirQuery] = useState("");

  /** Legacy Board Child: branch chips filter by pin.column (videos / images / …). */
  const scoped = useMemo(() => {
    if (!branchFilter.size) return workspace.filtered;
    return workspace.filtered.filter((p) => branchFilter.has(String(p.column)));
  }, [workspace.filtered, branchFilter]);

  function pinsForColumn(colId: string): Pin[] {
    if (colId === "all") {
      const q = dirQuery.trim().toLowerCase();
      if (!q) return scoped;
      return scoped.filter((p) =>
        [p.id, p.name, p.subtype, p.branch, ...(p.expectedClient || [])]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    if (colId === "draft") return scoped.filter(isDraft);
    if (colId === "archived") return scoped.filter(isArchived);
    return scoped.filter((p) => String(p.column) === colId && isActive(p));
  }

  const visibleColumns = useMemo(() => {
    return FORMAT_COLUMNS.filter((col) => {
      if (col.directory || col.id === "draft" || col.id === "archived") return true;
      if (!branchFilter.size) return true;
      return branchFilter.has(col.id);
    });
  }, [branchFilter]);

  const expandCols = visibleColumns.filter((c) => !c.directory);

  const workspaceProps = {
    title: "Board Child" as const,
    boardId: "formats" as const,
    workspace,
    searchPlaceholder: "Search board",
    branchFilter,
    onBranchFilterChange: setBranchFilter,
  };

  if (flatLay) {
    const activeId = expandCols.some((c) => c.id === flatLay)
      ? flatLay
      : expandCols[0]?.id || flatLay;
    return (
      <BoardWorkspace {...workspaceProps}>
        <div className="kanban is-flatlay">
          <FlatLayView
            columns={expandCols.map((c) => ({
              id: c.id,
              title: c.title,
              count: pinsForColumn(c.id).length,
            }))}
            activeId={activeId}
            pins={pinsForColumn(activeId)}
            onTabChange={setFlatLay}
            onBack={() => setFlatLay(null)}
            onOpenPin={(p) => workspace.openPin(p)}
          />
        </div>
      </BoardWorkspace>
    );
  }

  return (
    <BoardWorkspace {...workspaceProps}>
      {removal.canRemove ? (
        <BulkRemoveBar
          count={removal.selectedCount}
          onClear={removal.clearSelection}
          onRemove={removal.requestRemoveSelected}
        />
      ) : null}
      <div className="kanban">
        {visibleColumns.map((col) => {
          const pins = pinsForColumn(col.id);
          return (
            <KanbanColumn
              key={col.id}
              title={col.title}
              count={col.id === "all" ? scoped.length : pins.length}
              collapsed={collapsed.has(col.id)}
              className={col.id === "all" ? "kanban-col-directory" : ""}
              expandable={col.expandable}
              onExpand={() => setFlatLay(col.id)}
              onToggleCollapse={() =>
                setCollapsed((prev) => {
                  const next = new Set(prev);
                  if (next.has(col.id)) next.delete(col.id);
                  else next.add(col.id);
                  return next;
                })
              }
            >
              {col.id === "all" ? (
                <>
                  <SearchAutocomplete
                    wrapClassName="pin-dir-search-wrap"
                    inputClassName="pin-dir-search"
                    value={dirQuery}
                    onChange={setDirQuery}
                    suggestions={scoped.flatMap((p) => {
                      const items = [
                        { id: p.id, label: p.name, meta: "Pin" },
                        { id: `id:${p.id}`, label: p.id, meta: "Pin ID" },
                      ];
                      for (const c of p.expectedClient || []) {
                        items.push({ id: `client:${p.id}:${c}`, label: c, meta: "Client" });
                      }
                      if (p.branch) {
                        items.push({
                          id: `branch:${p.id}:${p.branch}`,
                          label: String(p.branch),
                          meta: "Branch",
                        });
                      }
                      return items;
                    })}
                    placeholder="Search pins, clients, branch…"
                    recentKey="ac:pin-dir"
                  />
                  {pins.length ? (
                    pins.map((pin) => (
                      <PinDirectoryRow
                        key={pin.id}
                        pin={pin}
                        showColumnChip
                        onExpand={(p) => workspace.openPin(p)}
                      />
                    ))
                  ) : (
                    <div className="pin-dir-empty">No pins match this search.</div>
                  )}
                </>
              ) : (
                <>
                  {pins.map((pin) => (
                    <PinCard
                      key={pin.id}
                      pin={{ ...pin, showColumnChip: true }}
                      onExpand={(p) => workspace.openPin(p)}
                      onDuplicate={workspace.onDuplicate}
                      selectable={removal.canRemove && col.id !== "archived"}
                      selected={removal.isSelected(pin.id)}
                      onToggleSelect={removal.toggleSelect}
                      onRemove={
                        removal.canRemove && col.id !== "archived"
                          ? removal.requestRemoveOne
                          : undefined
                      }
                    />
                  ))}
                  <button
                    type="button"
                    className="kanban-create"
                    onClick={() =>
                      workspace.createPin({
                        column: col.id === "draft" ? "videos" : col.id,
                        status: "Draft",
                      })
                    }
                  >
                    + Create
                  </button>
                </>
              )}
            </KanbanColumn>
          );
        })}
      </div>
      <ConfirmRemoveModal
        open={removal.confirmOpen}
        pins={removal.pendingPins}
        mode={removal.mode}
        pending={removal.busy}
        onConfirm={() => void removal.confirmRemove()}
        onClose={removal.cancelRemove}
      />
    </BoardWorkspace>
  );
}

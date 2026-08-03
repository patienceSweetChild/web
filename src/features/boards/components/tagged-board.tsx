"use client";

import { useMemo, useState } from "react";
import { BoardWorkspace } from "@/features/boards/components/board-workspace";
import { CoverageMatrix } from "@/features/boards/components/coverage-matrix";
import { FlatLayView } from "@/features/boards/components/flat-lay-view";
import { KanbanColumn } from "@/features/boards/components/kanban-column";
import { PinAttachModal } from "@/features/boards/components/pin-attach-modal";
import { useBoardWorkspace } from "@/features/boards/hooks/use-board-workspace";
import {
  CLIENT_DISPLAY_LABELS,
  MATRIX_PARENT_COL,
  UNASSIGNED_COL_ID,
  matrixLetterFor,
} from "@/features/boards/config";
import { PinCard } from "@/features/pins/components/pin-card";
import { usePinCatalog } from "@/features/pins/store/pin-catalog-provider";
import type { BoardId, Catalogs, Pin, PinTagField } from "@/features/pins/types";
import { useEffectiveBoardPermissions } from "@/features/boards/hooks/use-effective-board-permissions";

type TaggedBoardProps = {
  title: string;
  boardId: BoardId;
  catalogKey: keyof Pick<
    Catalogs,
    "expectedClients" | "sellingOptions" | "creativePackOptions"
  >;
  pinField: PinTagField;
  labelMap?: Record<string, string>;
  searchPlaceholder: string;
  listIntro: string;
  /** Matrix left-column header (Client / Sell Channel / Creative Pack). */
  rowHeader: string;
  /** List-view result label (clients / sell channels / creative packs). */
  listResultLabel: string;
  matrixClassName?: string;
  /** Flat-lay expand — Client only in legacy; Sell / Creative omit it. */
  columnExpand?: boolean;
  /** Shown under Unassigned (Client only in legacy). */
  unassignedSubtitle?: string;
  /** Show Expected Client column in list-view matrix. */
  showClientColumn?: boolean;
  /** Allow adding/removing clients in the Expected Client column. */
  clientColumnEditable?: boolean;
  /** Show + Existing in kanban columns (Sell / Creative). */
  kanbanExisting?: boolean;
};

function pinMatchesTag(pin: Pin, field: PinTagField, tag: string) {
  if (tag === UNASSIGNED_COL_ID) return !(pin[field] || []).length;
  return (pin[field] || []).includes(tag);
}

export function TaggedBoard({
  title,
  boardId,
  catalogKey,
  pinField,
  labelMap,
  searchPlaceholder,
  listIntro,
  rowHeader,
  listResultLabel,
  matrixClassName = "",
  columnExpand = false,
  unassignedSubtitle,
  showClientColumn = false,
  clientColumnEditable = false,
  kanbanExisting = false,
}: TaggedBoardProps) {
  const workspace = useBoardWorkspace(boardId);
  const { catalogs, upsertPin } = usePinCatalog();
  const perms = useEffectiveBoardPermissions(boardId);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [picker, setPicker] = useState<{ tag: string; branch: string } | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [clientPicker, setClientPicker] = useState<string | null>(null);
  const [clientPickerQuery, setClientPickerQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [branchFilter, setBranchFilter] = useState<Set<string>>(new Set());
  const [flatLay, setFlatLay] = useState<string | null>(null);

  const tags = catalogs[catalogKey];

  const filterKey: "expectedClient" | "selling" | "creativePack" =
    pinField === "expectedClient"
      ? "expectedClient"
      : pinField === "selling"
        ? "selling"
        : "creativePack";

  const tagFilter = workspace.filters[filterKey];

  /** Kanban: selected tag chips (or all) + Unassigned. */
  const kanbanColumns = useMemo(() => {
    const selected = [...tagFilter];
    const tagCols = (selected.length ? selected : tags.slice()).map((tag) => ({
      id: tag,
      title: tag,
      subtitle: labelMap?.[tag] && labelMap[tag] !== tag ? labelMap[tag] : undefined,
    }));
    return [
      ...tagCols,
      {
        id: UNASSIGNED_COL_ID,
        title: "Unassigned",
        subtitle: unassignedSubtitle,
      },
    ];
  }, [tags, tagFilter, labelMap, unassignedSubtitle]);

  /** Pins for kanban — workspace filters + format-column branch chips. */
  const kanbanPins = useMemo(() => {
    if (!branchFilter.size) return workspace.filtered;
    return workspace.filtered.filter((p) => branchFilter.has(String(p.column)));
  }, [workspace.filtered, branchFilter]);

  const byKanbanCol = useMemo(() => {
    const map = new Map<string, Pin[]>();
    kanbanColumns.forEach((col) => {
      const items = kanbanPins.filter((p) => pinMatchesTag(p, pinField, col.id));
      map.set(col.id, items);
    });
    return map;
  }, [kanbanColumns, kanbanPins, pinField]);

  /** Hide empty Unassigned when a tag filter is active (legacy). */
  const visibleKanbanColumns = useMemo(() => {
    return kanbanColumns.filter((col) => {
      if (col.id !== UNASSIGNED_COL_ID) return true;
      if (!tagFilter.size) return true;
      return (byKanbanCol.get(col.id) || []).length > 0;
    });
  }, [kanbanColumns, tagFilter, byKanbanCol]);

  /** List rows: filter by tag chips + search on title/label (legacy getRows). */
  const listRows = useMemo(() => {
    const q = workspace.query.trim().toLowerCase();
    const source = tagFilter.size ? tags.filter((t) => tagFilter.has(t)) : tags;
    return source
      .map((tag, i) => {
        const display = labelMap?.[tag] || tag;
        return {
          id: tag,
          title: tag,
          subtitle: display.toUpperCase(),
          letter: matrixLetterFor(i),
        };
      })
      .filter((row) => {
        if (!q) return true;
        const hay = `${row.title} ${row.subtitle}`.toLowerCase();
        return hay.includes(q);
      });
  }, [tags, tagFilter, labelMap, workspace.query]);

  /** List cells use all pins (legacy pinsForCell), not search-filtered. */
  const byListRow = useMemo(() => {
    const map = new Map<string, Pin[]>();
    listRows.forEach((row) => map.set(row.id, []));
    workspace.pins.forEach((pin) => {
      (pin[pinField] || []).forEach((t) => {
        if (!map.has(t)) return;
        map.get(t)!.push(pin);
      });
    });
    return map;
  }, [listRows, workspace.pins, pinField]);

  /** Expected clients aggregated from pins tagged to each row (legacy clientsForRow). */
  const clientsByRow = useMemo(() => {
    const map = new Map<string, string[]>();
    listRows.forEach((row) => {
      const seen = new Set<string>();
      const out: string[] = [];
      (byListRow.get(row.id) || []).forEach((p) => {
        (p.expectedClient || []).forEach((c) => {
          if (c && !seen.has(c)) {
            seen.add(c);
            out.push(c);
          }
        });
      });
      map.set(row.id, out);
    });
    return map;
  }, [listRows, byListRow]);

  const pickerItems = useMemo(() => {
    if (!picker) return [];
    const q = pickerQuery.trim().toLowerCase();
    const tagged = new Set(
      (byListRow.get(picker.tag) || [])
        .filter(
          (p) =>
            picker.branch === MATRIX_PARENT_COL.id ||
            !picker.branch ||
            String(p.branch) === picker.branch
        )
        .map((p) => p.id)
    );
    return workspace.pins
      .filter((p) => {
        if (
          picker.branch &&
          picker.branch !== MATRIX_PARENT_COL.id &&
          String(p.branch) !== picker.branch
        ) {
          return false;
        }
        if ((p[pinField] || []).includes(picker.tag)) return false;
        if (tagged.has(p.id)) return false;
        if (!q) return true;
        const hay = [p.id, p.name, p.subtype, ...(p.expectedClient || [])]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .map((p) => ({ id: p.id, name: p.name }));
  }, [picker, pickerQuery, byListRow, workspace.pins, pinField]);

  async function attachPin(pinId: string) {
    if (!picker) return;
    if (!perms.can_edit) return;
    const pin = workspace.pins.find((p) => p.id === pinId);
    if (!pin) return;
    const list = new Set(pin[pinField] || []);
    list.add(picker.tag);
    await upsertPin({ ...pin, [pinField]: [...list] }, { boardId });
    setPicker(null);
    setPickerQuery("");
  }

  async function untagPin(pinId: string, tag: string) {
    const pin = workspace.pins.find((p) => p.id === pinId);
    if (!pin) return;
    if (!perms.can_edit) return;
    await upsertPin({
      ...pin,
      [pinField]: (pin[pinField] || []).filter((t) => t !== tag),
    }, { boardId });
  }

  /** Client picker items — all expectedClients not already tagged to any pin in that row. */
  const clientPickerItems = useMemo(() => {
    if (!clientPicker) return [];
    const q = clientPickerQuery.trim().toLowerCase();
    const already = new Set(clientsByRow.get(clientPicker) || []);
    return catalogs.expectedClients
      .filter((c) => !already.has(c) && (!q || c.toLowerCase().includes(q)))
      .map((c) => ({ id: c, name: c }));
  }, [clientPicker, clientPickerQuery, clientsByRow, catalogs.expectedClients]);

  async function attachClient(client: string) {
    if (!clientPicker) return;
    if (!perms.can_edit) return;
    const rowPins = byListRow.get(clientPicker) || [];
    await Promise.all(
      rowPins.map((pin) => {
        if ((pin.expectedClient || []).includes(client)) return Promise.resolve();
        return upsertPin(
          { ...pin, expectedClient: [...(pin.expectedClient || []), client] },
          { boardId }
        );
      })
    );
    setClientPicker(null);
    setClientPickerQuery("");
  }

  async function untagClient(client: string, rowId: string) {
    if (!perms.can_edit) return;
    const rowPins = byListRow.get(rowId) || [];
    await Promise.all(
      rowPins.map((pin) => {
        if (!(pin.expectedClient || []).includes(client)) return Promise.resolve();
        return upsertPin({
          ...pin,
          expectedClient: (pin.expectedClient || []).filter((c) => c !== client),
        }, { boardId });
      })
    );
  }

  function setBoardView(next: "kanban" | "list") {
    setView(next);
    if (next !== "kanban") setFlatLay(null);
  }

  function createInColumn(colId: string) {
    if (!perms.can_create) return;
    if (colId === UNASSIGNED_COL_ID) {
      workspace.createPin({ status: "Draft" });
      return;
    }
    workspace.createPin({
      status: "Draft",
      [pinField]: [colId],
    });
  }

  const viewToggle = (
    <div className="view-toggle" role="group" aria-label="Board view">
      <button
        type="button"
        className={`view-toggle-btn${view === "kanban" ? " active" : ""}`}
        onClick={() => setBoardView("kanban")}
      >
        Kanban
      </button>
      <button
        type="button"
        className={`view-toggle-btn${view === "list" ? " active" : ""}`}
        onClick={() => setBoardView("list")}
      >
        List
      </button>
    </div>
  );

  const flatLayColumns = visibleKanbanColumns.map((col) => ({
    id: col.id,
    title: col.title,
    count: (byKanbanCol.get(col.id) || []).length,
  }));

  const resultCount =
    view === "list" ? listRows.length : new Set(kanbanPins.map((p) => p.id)).size;
  const resultLabel = view === "list" ? listResultLabel : "pins";

  return (
    <BoardWorkspace
      title={title}
      boardId={boardId}
      workspace={workspace}
      searchPlaceholder={searchPlaceholder}
      toolbarExtra={viewToggle}
      branchFilter={branchFilter}
      onBranchFilterChange={setBranchFilter}
      resultCount={resultCount}
      resultLabel={resultLabel}
      intro={view === "list" ? <p className="problems-intro">{listIntro}</p> : null}
      contentClassName={view === "list" ? "content content-problems" : "content"}
    >
      {view === "kanban" && flatLay && columnExpand ? (
        <div className="kanban is-flatlay">
          {(() => {
            const activeId = flatLayColumns.some((c) => c.id === flatLay)
              ? flatLay
              : flatLayColumns[0]?.id || flatLay;
            return (
              <FlatLayView
                columns={flatLayColumns}
                activeId={activeId}
                pins={byKanbanCol.get(activeId) || []}
                onTabChange={setFlatLay}
                onBack={() => setFlatLay(null)}
                onOpenPin={(p) => workspace.openPin(p)}
              />
            );
          })()}
        </div>
      ) : view === "kanban" ? (
        <div className="kanban">
          {visibleKanbanColumns.map((col) => {
            const pins = byKanbanCol.get(col.id) || [];
            return (
              <KanbanColumn
                key={col.id}
                title={col.title}
                subtitle={col.subtitle}
                count={pins.length}
                collapsed={collapsed.has(col.id)}
                expandable={columnExpand}
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
                {pins.map((pin) => (
                  <PinCard
                    key={pin.id}
                    pin={pin}
                    variant="formats"
                    onExpand={(p) => workspace.openPin(p)}
                    onDuplicate={workspace.onDuplicate}
                  />
                ))}
                <button
                  type="button"
                  className="kanban-create"
                  onClick={() => createInColumn(col.id)}
                >
                  + Create
                </button>
                {kanbanExisting && col.id !== UNASSIGNED_COL_ID ? (
                  <button
                    type="button"
                    className="kanban-create secondary"
                    onClick={() => {
                      if (!perms.can_edit) return;
                      setPicker({ tag: col.id, branch: MATRIX_PARENT_COL.id });
                    }}
                  >
                    + Existing
                  </button>
                ) : null}
              </KanbanColumn>
            );
          })}
        </div>
      ) : (
        <CoverageMatrix
          className={matrixClassName}
          rowHeader={rowHeader}
          showClientColumn={showClientColumn}
          clientColumnReadonly={!clientColumnEditable || !perms.can_edit}
          rows={listRows}
          pinsByRow={byListRow}
          clientsByRow={clientsByRow}
          onOpenPin={(id) => {
            const pin = workspace.pins.find((p) => p.id === id);
            if (pin) workspace.openPin(pin);
          }}
          onUntagPin={(pinId, rowId) => void untagPin(pinId, rowId)}
          onAddExisting={(rowId, branchId) => {
            if (!perms.can_edit) return;
            setPicker({ tag: rowId, branch: branchId });
          }}
          onAddClient={(rowId) => {
            if (!perms.can_edit) return;
            setClientPicker(rowId);
          }}
          onUntagClient={(client, rowId) => void untagClient(client, rowId)}
        />
      )}

      <PinAttachModal
        open={!!picker}
        query={pickerQuery}
        onQueryChange={setPickerQuery}
        items={pickerItems}
        onSelect={(id) => void attachPin(id)}
        onClose={() => {
          setPicker(null);
          setPickerQuery("");
        }}
      />
      <PinAttachModal
        open={!!clientPicker}
        query={clientPickerQuery}
        onQueryChange={setClientPickerQuery}
        items={clientPickerItems}
        onSelect={(id) => void attachClient(id)}
        onClose={() => {
          setClientPicker(null);
          setClientPickerQuery("");
        }}
      />
    </BoardWorkspace>
  );
}

export function ClientsBoard() {
  return (
    <TaggedBoard
      title="Client"
      boardId="clients"
      catalogKey="expectedClients"
      pinField="expectedClient"
      labelMap={CLIENT_DISPLAY_LABELS}
      searchPlaceholder="Search clients"
      rowHeader="Client"
      listResultLabel="clients"
      listIntro="Coverage by client × branch. Every cell shows which Pins are tagged to that client in that branch."
      matrixClassName="client-list"
      columnExpand
      unassignedSubtitle="No expected client"
      showClientColumn={false}
    />
  );
}

export function SellChannelsBoard() {
  return (
    <TaggedBoard
      title="Sell Channels"
      boardId="sell-channels"
      catalogKey="sellingOptions"
      pinField="selling"
      searchPlaceholder="Search sell channels"
      rowHeader="Sell Channel"
      listResultLabel="sell channels"
      listIntro="Coverage by sell channel × branch. Every cell shows which Pins are tagged to that sell channel in that branch."
      matrixClassName="sell-list"
      showClientColumn
      clientColumnEditable
      kanbanExisting
    />
  );
}

export function CreativePacksBoard() {
  return (
    <TaggedBoard
      title="Creative Pack"
      boardId="creative-packs"
      catalogKey="creativePackOptions"
      pinField="creativePack"
      searchPlaceholder="Search creative packs"
      rowHeader="Creative Pack"
      listResultLabel="creative packs"
      listIntro="Coverage by creative pack × branch. Every cell shows which Pins are tagged to that creative pack in that branch."
      matrixClassName="creative-list"
      showClientColumn
      clientColumnEditable
      kanbanExisting
    />
  );
}

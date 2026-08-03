"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePinCatalog } from "@/features/pins/store/pin-catalog-provider";
import {
  addProjectItems,
  removeProjectItems,
} from "@/features/onboarding/actions";
import { PinsFormatBoard } from "@/features/onboarding/components/pins-format-board";
import type { ProjectItem } from "@/features/onboarding/types";
import type { Pin } from "@/features/pins/types";

export function ProjectOverviewPins({
  projectId,
  initialItems,
  canEdit,
}: {
  projectId: string;
  initialItems: ProjectItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { pins } = usePinCatalog();
  const [pending, startTransition] = useTransition();
  const [itemIds, setItemIds] = useState(initialItems.map((i) => i.pin_id));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  const projectPins = useMemo(
    () => itemIds.map((id) => pins.find((p) => p.id === id)).filter(Boolean) as Pin[],
    [itemIds, pins]
  );

  const pickerPins = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    const have = new Set(itemIds);
    return pins
      .filter((p) => !have.has(p.id))
      .filter(
        (p) =>
          !q ||
          p.id.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [pins, itemIds, pickerQuery]);

  function toggleSelect(pinId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pinId)) next.delete(pinId);
      else next.add(pinId);
      return next;
    });
  }

  function removeOne(pinId: string) {
    if (!canEdit) return;
    setItemIds((prev) => prev.filter((id) => id !== pinId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(pinId);
      return next;
    });
    startTransition(async () => {
      await removeProjectItems(projectId, [pinId]);
      router.refresh();
    });
  }

  function bulkRemove() {
    if (!canEdit || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setItemIds((prev) => prev.filter((id) => !selectedIds.has(id)));
    setSelectedIds(new Set());
    startTransition(async () => {
      await removeProjectItems(projectId, ids);
      router.refresh();
    });
  }

  function addPin(pinId: string) {
    if (!canEdit) return;
    setItemIds((prev) => (prev.includes(pinId) ? prev : [...prev, pinId]));
    startTransition(async () => {
      await addProjectItems(projectId, [pinId]);
      router.refresh();
    });
  }

  return (
    <div style={{ marginTop: 20 }}>
      <PinsFormatBoard
        title="Project pins"
        subtitle={`${projectPins.length} pin${projectPins.length === 1 ? "" : "s"} on this project`}
        pins={projectPins}
        view={view}
        onViewChange={setView}
        selectedIds={selectedIds}
        onToggleSelect={canEdit ? toggleSelect : undefined}
        onRemove={canEdit ? removeOne : undefined}
        emptyLabel="No pins on this project yet. Add pins below or checkout from Onboarding."
        actions={
          canEdit ? (
            <>
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  className="btn"
                  disabled={pending}
                  onClick={bulkRemove}
                >
                  Bulk remove ({selectedIds.size})
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setPickerOpen((v) => !v)}
              >
                {pickerOpen ? "Close picker" : "Add pins"}
              </button>
            </>
          ) : undefined
        }
      />

      {pickerOpen && canEdit && (
        <div className="ob-empty" style={{ marginTop: 12 }}>
          <input
            className="search"
            style={{ width: "100%", marginBottom: 10 }}
            value={pickerQuery}
            onChange={(e) => setPickerQuery(e.target.value)}
            placeholder="Search pins to add…"
          />
          <div className="ob-pin-list">
            {pickerPins.map((pin) => (
              <div key={pin.id} className="ob-pin-row">
                <span className="ob-pin-id">{pin.id}</span>
                <span className="ob-pin-name">{pin.name}</span>
                <span className="ob-muted">{pin.price}</span>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={pending}
                  onClick={() => addPin(pin.id)}
                >
                  Add
                </button>
              </div>
            ))}
            {pickerPins.length === 0 && (
              <div className="ob-muted">No matching pins to add.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

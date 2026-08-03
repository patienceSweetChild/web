"use client";

import { useCallback, useMemo, useState } from "react";
import { useEffectiveBoardPermissions } from "@/features/boards/hooks/use-effective-board-permissions";
import { usePinCatalog } from "@/features/pins/store/pin-catalog-provider";
import type { BoardId, Pin, PinTagField } from "@/features/pins/types";

export type PinRemovalMode = "delete" | "untag" | "archive";

export type RemovalTarget = {
  id: string;
  name: string;
  /** Column/tag scope for untag mode. */
  scope?: string;
};

function selectionKey(id: string, scope?: string) {
  return scope ? `${id}::${scope}` : id;
}

type UsePinRemovalOptions = {
  entityLabel?: string;
  mode: PinRemovalMode;
  /** Required when mode is "untag". */
  pinField?: PinTagField;
};

/** Selection + confirmed remove. Parent deletes; other boards untag/archive only. */
export function usePinRemoval(boardId: BoardId, options: UsePinRemovalOptions) {
  const { entityLabel = "pin", mode, pinField } = options;
  const { pins, deletePin, upsertPin } = usePinCatalog();
  const perms = useEffectiveBoardPermissions(boardId);
  const canRemove = Boolean(perms.can_delete || perms.can_edit);

  const [selected, setSelected] = useState<Map<string, RemovalTarget>>(new Map());
  const [pending, setPending] = useState<RemovalTarget[] | null>(null);
  const [busy, setBusy] = useState(false);

  const isSelected = useCallback(
    (id: string, scope?: string) => selected.has(selectionKey(id, scope)),
    [selected]
  );

  const toggleSelect = useCallback((pin: Pin, scope?: string) => {
    const key = selectionKey(pin.id, scope);
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, { id: pin.id, name: pin.name || pin.id, scope });
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Map()), []);

  const requestRemove = useCallback((targets: RemovalTarget[]) => {
    if (!targets.length) return;
    setPending(targets);
  }, []);

  const requestRemoveOne = useCallback(
    (pin: Pin, scope?: string) =>
      requestRemove([{ id: pin.id, name: pin.name || pin.id, scope }]),
    [requestRemove]
  );

  const requestRemoveSelected = useCallback(() => {
    requestRemove([...selected.values()]);
  }, [requestRemove, selected]);

  const cancelRemove = useCallback(() => {
    if (busy) return;
    setPending(null);
  }, [busy]);

  const confirmRemove = useCallback(async () => {
    if (!pending?.length || !canRemove) return;
    setBusy(true);
    try {
      if (mode === "delete") {
        const ids = [...new Set(pending.map((t) => t.id))];
        await Promise.all(ids.map((id) => deletePin(id, { boardId })));
      } else if (mode === "archive") {
        const ids = [...new Set(pending.map((t) => t.id))];
        await Promise.all(
          ids.map((id) => {
            const pin = pins.find((p) => p.id === id);
            if (!pin) return Promise.resolve();
            return upsertPin({ ...pin, status: "Archived" }, { boardId });
          })
        );
      } else if (mode === "untag" && pinField) {
        // Group scopes by pin so multi-column bulk untag works in one upsert.
        const byPin = new Map<string, Set<string>>();
        for (const t of pending) {
          if (!t.scope) continue;
          const set = byPin.get(t.id) ?? new Set<string>();
          set.add(t.scope);
          byPin.set(t.id, set);
        }
        await Promise.all(
          [...byPin.entries()].map(([id, scopes]) => {
            const pin = pins.find((p) => p.id === id);
            if (!pin) return Promise.resolve();
            const nextTags = (pin[pinField] || []).filter((tag) => !scopes.has(tag));
            return upsertPin({ ...pin, [pinField]: nextTags }, { boardId });
          })
        );
      }

      setSelected((prev) => {
        const next = new Map(prev);
        pending.forEach((t) => next.delete(selectionKey(t.id, t.scope)));
        return next;
      });
      setPending(null);
    } finally {
      setBusy(false);
    }
  }, [pending, canRemove, mode, pinField, deletePin, upsertPin, pins, boardId]);

  const pendingPins = useMemo(() => pending ?? [], [pending]);

  return {
    canRemove,
    entityLabel,
    mode,
    selectedCount: selected.size,
    isSelected,
    toggleSelect,
    clearSelection,
    requestRemoveOne,
    requestRemoveSelected,
    cancelRemove,
    confirmRemove,
    pendingPins,
    confirmOpen: pendingPins.length > 0,
    busy,
  };
}

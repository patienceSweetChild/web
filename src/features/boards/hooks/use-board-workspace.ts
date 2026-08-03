"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { emptyPinFilters, type PinFilterState } from "@/features/pins/lib/filters";
import {
  createDraftPin,
  duplicatePin,
  pinMatchesFilters,
  pinMatchesQuery,
  pinsForBoard,
  type CreateDraftOptions,
} from "@/features/pins/lib/pin-utils";
import { usePinCatalog } from "@/features/pins/store/pin-catalog-provider";
import type { BoardId, Pin } from "@/features/pins/types";
import type { PinDetailMode } from "@/features/pins/components/pin-detail-drawer";

/** Shared workspace state for every board surface (search, filters, detail drawer). */
export function useBoardWorkspace(boardId: BoardId) {
  const { pins: catalogPins, upsertPin, ready } = usePinCatalog();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<PinFilterState>(emptyPinFilters());
  const [activePin, setActivePin] = useState<Pin | null>(null);
  const [detailMode, setDetailMode] = useState<PinDetailMode>("edit");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Parent ids only on Board Parent; all other boards exclude them.
  const pins = useMemo(() => pinsForBoard(boardId, catalogPins), [boardId, catalogPins]);

  const filtered = useMemo(
    () => pins.filter((p) => pinMatchesQuery(p, query) && pinMatchesFilters(p, filters)),
    [pins, query, filters]
  );

  // Close drawer if an *existing* pin was removed from the catalog.
  // Skip in create mode — drafts are not in `pins` until saved.
  useEffect(() => {
    if (!activePin || detailMode === "create") return;
    if (catalogPins.some((p) => p.id === activePin.id)) return;
    setDrawerOpen(false);
    setActivePin(null);
  }, [catalogPins, activePin, detailMode]);

  const openPin = useCallback((pin: Pin, mode: PinDetailMode = "edit") => {
    setActivePin(pin);
    setDetailMode(mode);
    setDrawerOpen(true);
  }, []);

  const createPin = useCallback(
    (options?: CreateDraftOptions) => {
      const draftOptions: CreateDraftOptions =
        boardId === "catalog"
          ? { ...options, subtype: options?.subtype || "Parent" }
          : options || {};
      openPin(createDraftPin(catalogPins, draftOptions), "create");
    },
    [openPin, catalogPins, boardId]
  );

  const onDuplicate = useCallback(
    (pin: Pin, format?: string) => {
      openPin(duplicatePin(catalogPins, pin, format), "create");
    },
    [openPin, catalogPins]
  );

  const onSave = useCallback(
    async (pin: Pin) => {
      await upsertPin(pin, { boardId });
    },
    [upsertPin, boardId]
  );

  return {
    ready,
    pins,
    filtered,
    query,
    setQuery,
    filters,
    setFilters,
    activePin,
    detailMode,
    drawerOpen,
    setDrawerOpen,
    openPin,
    createPin,
    onDuplicate,
    onSave,
    boardId,
  };
}

export type BoardWorkspaceController = ReturnType<typeof useBoardWorkspace>;

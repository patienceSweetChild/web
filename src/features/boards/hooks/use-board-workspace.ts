"use client";

import { useCallback, useMemo, useState } from "react";
import { emptyPinFilters, type PinFilterState } from "@/features/pins/lib/filters";
import {
  createDraftPin,
  duplicatePin,
  pinMatchesFilters,
  pinMatchesQuery,
  type CreateDraftOptions,
} from "@/features/pins/lib/pin-utils";
import { usePinCatalog } from "@/features/pins/store/pin-catalog-provider";
import type { BoardId, Pin } from "@/features/pins/types";
import type { PinDetailMode } from "@/features/pins/components/pin-detail-drawer";

/** Shared workspace state for every board surface (search, filters, detail drawer). */
export function useBoardWorkspace(boardId: BoardId) {
  const { pins, upsertPin, ready } = usePinCatalog();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<PinFilterState>(emptyPinFilters());
  const [activePin, setActivePin] = useState<Pin | null>(null);
  const [detailMode, setDetailMode] = useState<PinDetailMode>("edit");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = useMemo(
    () => pins.filter((p) => pinMatchesQuery(p, query) && pinMatchesFilters(p, filters)),
    [pins, query, filters]
  );

  const openPin = useCallback((pin: Pin, mode: PinDetailMode = "edit") => {
    setActivePin(pin);
    setDetailMode(mode);
    setDrawerOpen(true);
  }, []);

  const createPin = useCallback(
    (options?: CreateDraftOptions) => {
      openPin(createDraftPin(pins, options), "create");
    },
    [openPin, pins]
  );

  const onDuplicate = useCallback(
    (pin: Pin, format?: string) => {
      openPin(duplicatePin(pins, pin, format), "create");
    },
    [openPin, pins]
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

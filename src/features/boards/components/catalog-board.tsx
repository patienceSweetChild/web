"use client";

import { BoardWorkspace } from "@/features/boards/components/board-workspace";
import { useBoardWorkspace } from "@/features/boards/hooks/use-board-workspace";
import { PinCard } from "@/features/pins/components/pin-card";

export function CatalogBoard() {
  const workspace = useBoardWorkspace("catalog");
  return (
    <BoardWorkspace title="Board Parent" boardId="catalog" workspace={workspace}>
      <div className="pin-grid">
        {workspace.filtered.map((pin) => (
          <PinCard
            key={pin.id}
            pin={pin}
            variant="formats"
            onExpand={(p) => workspace.openPin(p)}
            onDuplicate={workspace.onDuplicate}
          />
        ))}
      </div>
    </BoardWorkspace>
  );
}

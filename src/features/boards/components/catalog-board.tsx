"use client";

import { BoardWorkspace } from "@/features/boards/components/board-workspace";
import { BulkRemoveBar } from "@/features/boards/components/bulk-remove-bar";
import { ConfirmRemoveModal } from "@/features/boards/components/confirm-remove-modal";
import { useBoardWorkspace } from "@/features/boards/hooks/use-board-workspace";
import { usePinRemoval } from "@/features/boards/hooks/use-pin-removal";
import { PinCard } from "@/features/pins/components/pin-card";

export function CatalogBoard() {
  const workspace = useBoardWorkspace("catalog");
  const removal = usePinRemoval("catalog", { mode: "delete" });

  return (
    <BoardWorkspace title="Board Parent" boardId="catalog" workspace={workspace}>
      {removal.canRemove ? (
        <BulkRemoveBar
          count={removal.selectedCount}
          onClear={removal.clearSelection}
          onRemove={removal.requestRemoveSelected}
        />
      ) : null}
      <div className="pin-grid">
        {workspace.filtered.map((pin) => (
          <PinCard
            key={pin.id}
            pin={pin}
            variant="formats"
            onExpand={(p) => workspace.openPin(p)}
            onDuplicate={workspace.onDuplicate}
            selectable={removal.canRemove}
            selected={removal.isSelected(pin.id)}
            onToggleSelect={removal.toggleSelect}
            onRemove={removal.canRemove ? removal.requestRemoveOne : undefined}
          />
        ))}
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

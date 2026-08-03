"use client";

type BulkRemoveBarProps = {
  count: number;
  entityLabel?: string;
  onClear: () => void;
  onRemove: () => void;
};

/** Sticky selection toolbar for bulk pin removal on kanban / grid boards. */
export function BulkRemoveBar({
  count,
  entityLabel = "pin",
  onClear,
  onRemove,
}: BulkRemoveBarProps) {
  if (count <= 0) return null;

  const plural = count === 1 ? entityLabel : `${entityLabel}s`;

  return (
    <div className="bulk-remove-bar" role="status">
      <span className="bulk-remove-count">
        <strong>{count}</strong> {plural} selected
      </span>
      <div className="bulk-remove-actions">
        <button type="button" className="btn btn-ghost" onClick={onClear}>
          Clear
        </button>
        <button type="button" className="btn btn-danger" onClick={onRemove}>
          Remove selected
        </button>
      </div>
    </div>
  );
}

"use client";

import type { PinRemovalMode } from "@/features/boards/hooks/use-pin-removal";

type ConfirmRemoveModalProps = {
  open: boolean;
  pins: { id: string; name: string; scope?: string }[];
  /** Singular entity word shown in copy ("pin" | "pack"). */
  entityLabel?: string;
  mode?: PinRemovalMode;
  /**
   * Expected Client: stress that untag is for this column only,
   * and the pin can remain on other client columns.
   */
  columnScoped?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

function uniqueScopes(pins: { scope?: string }[]) {
  return [...new Set(pins.map((p) => p.scope).filter(Boolean))] as string[];
}

function leadCopy(
  mode: PinRemovalMode,
  count: number,
  columnScoped: boolean,
  scopes: string[]
) {
  if (mode === "delete") {
    return count === 1
      ? "You're about to permanently delete this from the library. This can't be undone."
      : "You're about to permanently delete these from the library. This can't be undone.";
  }
  if (mode === "archive") {
    return count === 1
      ? "This will archive it on Board Child. It stays in the library and can be restored from Archived."
      : "These will be archived on Board Child. They stay in the library and can be restored from Archived.";
  }
  if (columnScoped) {
    if (scopes.length === 1) {
      return count === 1
        ? `This removes it from the “${scopes[0]}” column only. It stays in the library and in any other expected clients it’s tagged to.`
        : `These will be removed from the “${scopes[0]}” column only. They stay in the library and in any other expected clients they’re tagged to.`;
    }
    return count === 1
      ? "This removes it from the selected expected client column(s) only. It stays in the library and in any other clients it’s tagged to."
      : "These will be removed from the selected expected client column(s) only. They stay in the library and in any other clients they’re tagged to.";
  }
  return count === 1
    ? "This removes it from this board only. It stays in the library."
    : "These will be removed from this board only. They stay in the library.";
}

function titleCopy(
  entityLabel: string,
  count: number,
  columnScoped: boolean,
  scopes: string[]
) {
  const plural = count === 1 ? entityLabel : `${entityLabel}s`;
  if (columnScoped && scopes.length === 1) {
    return count === 1
      ? `Remove from “${scopes[0]}”?`
      : `Remove ${count} ${plural} from “${scopes[0]}”?`;
  }
  return count === 1 ? `Remove ${entityLabel}?` : `Remove ${count} ${plural}?`;
}

/** Confirm dialog for single or bulk pin removal — picker-modal styling. */
export function ConfirmRemoveModal({
  open,
  pins,
  entityLabel = "pin",
  mode = "delete",
  columnScoped = false,
  pending = false,
  onConfirm,
  onClose,
}: ConfirmRemoveModalProps) {
  if (!open || !pins.length) return null;

  const scopes = uniqueScopes(pins);
  const plural = pins.length === 1 ? entityLabel : `${entityLabel}s`;
  const title = titleCopy(entityLabel, pins.length, columnScoped, scopes);

  return (
    <div
      className="picker-backdrop open"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="picker-modal confirm-remove-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmRemoveTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="picker-head">
          <h2 id="confirmRemoveTitle">{title}</h2>
          <button
            type="button"
            className="btn btn-ghost picker-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="confirm-remove-body">
          <p className="confirm-remove-lead">
            {leadCopy(mode, pins.length, columnScoped, scopes)}
          </p>
          {columnScoped ? (
            <p className="confirm-remove-emphasis">
              {scopes.length === 1 ? (
                <>
                  Column: <strong>{scopes[0]}</strong>
                </>
              ) : (
                <>
                  Columns:{" "}
                  <strong>{scopes.join(", ") || "selected columns"}</strong>
                </>
              )}
            </p>
          ) : null}
          <ul className="confirm-remove-names">
            {pins.map((p) => (
              <li key={p.scope ? `${p.id}::${p.scope}` : p.id}>
                <span className="confirm-remove-name">{p.name}</span>
                <span className="confirm-remove-id">
                  {p.scope ? `${p.id} · ${p.scope}` : p.id}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="assign-modal-footer">
          <div className="assign-modal-actions">
            <button type="button" className="btn" onClick={onClose} disabled={pending}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={onConfirm}
              disabled={pending}
            >
              {pending
                ? "Removing…"
                : columnScoped && scopes.length === 1
                  ? `Remove from column`
                  : pins.length === 1
                    ? `Remove ${entityLabel}`
                    : `Remove ${pins.length} ${plural}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

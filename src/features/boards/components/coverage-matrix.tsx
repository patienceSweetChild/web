"use client";

import {
  MATRIX_BRANCH_COLS,
  MATRIX_PARENT_COL,
} from "@/features/boards/config";
import type { Pin } from "@/features/pins/types";

export type MatrixBoardCol = {
  id: string;
  title: string;
  thClass: string;
};

type CoverageMatrixProps = {
  /** Left-column header label */
  rowHeader: string;
  rows: {
    id: string;
    letter?: string;
    title: string;
    subtitle?: string;
  }[];
  /** Pins already tagged per row id */
  pinsByRow: Map<string, Pin[]>;
  /** Optional expected-client tags per row (problems / tag boards) */
  clientsByRow?: Map<string, string[]>;
  showClientColumn?: boolean;
  /**
   * When true (Client / Sell / Creative list view), Expected Client cells are
   * display-only — no + Existing / remove, matching createTagMatrixController.
   */
  clientColumnReadonly?: boolean;
  includeParentColumn?: boolean;
  branchCols?: readonly MatrixBoardCol[];
  onOpenPin: (pinId: string) => void;
  onUntagPin: (pinId: string, rowId: string) => void;
  onAddExisting: (rowId: string, branchId: string) => void;
  onAddClient?: (rowId: string) => void;
  onUntagClient?: (client: string, rowId: string) => void;
  className?: string;
};

function PinPills({
  pins,
  rowId,
  onOpenPin,
  onUntagPin,
}: {
  pins: Pin[];
  rowId: string;
  onOpenPin: (id: string) => void;
  onUntagPin: (pinId: string, rowId: string) => void;
}) {
  if (!pins.length) return null;
  return (
    <div className="matrix-pills">
      {pins.map((p) => (
        <span
          key={p.id}
          className="matrix-pill"
          title={p.name}
          onClick={() => onOpenPin(p.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") onOpenPin(p.id);
          }}
        >
          {p.id} {p.name}
          <button
            type="button"
            className="matrix-pill-x"
            aria-label="Remove"
            onClick={(e) => {
              e.stopPropagation();
              onUntagPin(p.id, rowId);
            }}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

function BranchCell({
  rowId,
  branchId,
  pins,
  onOpenPin,
  onUntagPin,
  onAddExisting,
}: {
  rowId: string;
  branchId: string;
  pins: Pin[];
  onOpenPin: (id: string) => void;
  onUntagPin: (pinId: string, rowId: string) => void;
  onAddExisting: (rowId: string, branchId: string) => void;
}) {
  const countLabel = pins.length
    ? `${pins.length} tagged`
    : "No board tagged yet.";
  return (
    <td data-row={rowId} data-branch={branchId}>
      <div className="matrix-cell-head">
        <span className="matrix-count">{countLabel}</span>
        <div className="matrix-actions">
          <button
            type="button"
            className="matrix-action"
            onClick={() => onAddExisting(rowId, branchId)}
          >
            + Existing
          </button>
        </div>
      </div>
      <PinPills
        pins={pins}
        rowId={rowId}
        onOpenPin={onOpenPin}
        onUntagPin={onUntagPin}
      />
    </td>
  );
}

/** Problems / Client / Sell / Creative list-view matrix using legacy CSS classes. */
export function CoverageMatrix({
  rowHeader,
  rows,
  pinsByRow,
  clientsByRow,
  showClientColumn = false,
  clientColumnReadonly = false,
  includeParentColumn = true,
  branchCols = MATRIX_BRANCH_COLS,
  onOpenPin,
  onUntagPin,
  onAddExisting,
  onAddClient,
  onUntagClient,
  className = "",
}: CoverageMatrixProps) {
  const boardCols: MatrixBoardCol[] = includeParentColumn
    ? [MATRIX_PARENT_COL, ...branchCols]
    : [...branchCols];

  function pinsFor(rowId: string, branchId: string) {
    const all = pinsByRow.get(rowId) || [];
    if (branchId === MATRIX_PARENT_COL.id) return all;
    return all.filter((p) => String(p.branch) === branchId);
  }

  return (
    <div className={`problems-matrix-wrap ${className}`.trim()}>
      <table className="problems-matrix">
        <thead>
          <tr>
            <th className="th-problem">{rowHeader}</th>
            {showClientColumn ? (
              <th className="th-client">
                Expected Client
                <span className="th-sub">Tagged Clients</span>
              </th>
            ) : null}
            {boardCols.map((b) => (
              <th key={b.id} className={b.thClass}>
                {b.title}
                <span className="th-sub">Tagged Pins</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const clients = clientsByRow?.get(row.id) || [];
            return (
              <tr key={row.id} data-problem-row={row.id} data-matrix-row={row.id}>
                <td className="td-problem">
                  <div className="problem-cell">
                    {row.letter ? (
                      <span className="problem-letter">{row.letter}</span>
                    ) : null}
                    <div>
                      <div className="problem-title">{row.title}</div>
                      {row.subtitle ? (
                        <div className="problem-label">{row.subtitle}</div>
                      ) : null}
                    </div>
                  </div>
                </td>
                {showClientColumn ? (
                  <td data-branch="__client__">
                    <div className="matrix-cell-head">
                      <span className="matrix-count">
                        {clients.length
                          ? `${clients.length} tagged`
                          : "No client tagged yet."}
                      </span>
                      {!clientColumnReadonly ? (
                        <div className="matrix-actions">
                          <button
                            type="button"
                            className="matrix-action"
                            onClick={() => onAddClient?.(row.id)}
                          >
                            + Existing
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {clients.length ? (
                      <div className="matrix-pills">
                        {clients.map((c) => (
                          <span key={c} className="matrix-pill client-pill">
                            {c}
                            {!clientColumnReadonly ? (
                              <button
                                type="button"
                                className="matrix-pill-x"
                                aria-label="Remove"
                                onClick={() => onUntagClient?.(c, row.id)}
                              >
                                ×
                              </button>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </td>
                ) : null}
                {boardCols.map((b) => (
                  <BranchCell
                    key={b.id}
                    rowId={row.id}
                    branchId={b.id}
                    pins={pinsFor(row.id, b.id)}
                    onOpenPin={onOpenPin}
                    onUntagPin={onUntagPin}
                    onAddExisting={onAddExisting}
                  />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import type { Pin } from "@/features/pins/types";
import { FORMAT_COLUMNS, type FormatColumnId } from "../types";
import { groupPinsByFormat } from "../lib/recommend";

export function PinsFormatBoard({
  pins,
  view,
  onViewChange,
  selectedIds,
  onToggleSelect,
  onRemove,
  emptyLabel = "No pins",
  title,
  subtitle,
  actions,
}: {
  pins: Pin[];
  view: "kanban" | "list";
  onViewChange: (v: "kanban" | "list") => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (pinId: string) => void;
  onRemove?: (pinId: string) => void;
  emptyLabel?: string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const groups = groupPinsByFormat(pins);

  return (
    <div className="ob-pins-board">
      <div className="ob-pins-board-header">
        <div>
          {title && <h3 className="ob-section-title">{title}</h3>}
          {subtitle && <p className="ob-muted">{subtitle}</p>}
        </div>
        <div className="ob-pins-board-tools">
          {actions}
          <div className="view-toggle" role="group" aria-label="Pin view">
            <button
              type="button"
              className={`view-toggle-btn${view === "kanban" ? " active" : ""}`}
              onClick={() => onViewChange("kanban")}
            >
              Kanban
            </button>
            <button
              type="button"
              className={`view-toggle-btn${view === "list" ? " active" : ""}`}
              onClick={() => onViewChange("list")}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {pins.length === 0 ? (
        <div className="ob-empty">{emptyLabel}</div>
      ) : view === "list" ? (
        <div className="ob-pin-list">
          {pins.map((pin) => (
            <PinRow
              key={pin.id}
              pin={pin}
              selected={selectedIds?.has(pin.id)}
              onToggleSelect={onToggleSelect}
              onRemove={onRemove}
            />
          ))}
        </div>
      ) : (
        <div className="ob-kanban">
          {FORMAT_COLUMNS.map((col) => (
            <div key={col.id} className="ob-kanban-col">
              <div
                className="ob-kanban-col-head"
                style={{ background: col.color }}
              >
                <span>{col.label}</span>
                <span className="ob-kanban-count">{groups[col.id as FormatColumnId].length}</span>
              </div>
              <div className="ob-kanban-col-body">
                {groups[col.id as FormatColumnId].length === 0 ? (
                  <div className="ob-kanban-empty">No Pins in this format</div>
                ) : (
                  groups[col.id as FormatColumnId].map((pin) => (
                    <PinCard
                      key={pin.id}
                      pin={pin}
                      selected={selectedIds?.has(pin.id)}
                      onToggleSelect={onToggleSelect}
                      onRemove={onRemove}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PinCard({
  pin,
  selected,
  onToggleSelect,
  onRemove,
}: {
  pin: Pin;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  return (
    <div className={`ob-pin-card${selected ? " selected" : ""}`}>
      <div className="ob-pin-card-top">
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onToggleSelect(pin.id)}
            aria-label={`Select ${pin.name}`}
          />
        )}
        <span className="ob-pin-id">{pin.id}</span>
        {pin.PM && <span className="ob-pin-pm">PM</span>}
      </div>
      <div className="ob-pin-name">{pin.name}</div>
      <div className="ob-muted">
        {pin.footerLabel || pin.subtype} {pin.price}
      </div>
      <div className="ob-pin-metrics">
        <span>{pin.hooks ?? 0} Hooks</span>
        <span>{pin.angles ?? 0} Angles</span>
        <span>{pin.executions ?? 0} Execution</span>
        <span className="ob-pin-assets">{pin.assets ?? 0} ASSETS</span>
      </div>
      {onRemove && (
        <button type="button" className="btn ob-pin-remove" onClick={() => onRemove(pin.id)}>
          Remove
        </button>
      )}
    </div>
  );
}

function PinRow({
  pin,
  selected,
  onToggleSelect,
  onRemove,
}: {
  pin: Pin;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  return (
    <div className={`ob-pin-row${selected ? " selected" : ""}`}>
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={() => onToggleSelect(pin.id)}
          aria-label={`Select ${pin.name}`}
        />
      )}
      <span className="ob-pin-id">{pin.id}</span>
      <span className="ob-pin-name">{pin.name}</span>
      <span className="ob-muted">{pin.price}</span>
      <span className="ob-muted">{pin.column}</span>
      {onRemove && (
        <button type="button" className="btn" onClick={() => onRemove(pin.id)}>
          Remove
        </button>
      )}
    </div>
  );
}

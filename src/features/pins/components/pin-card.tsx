"use client";

import { formatAssetCounts, primaryFormatKey } from "@/features/pins/lib/pin-utils";
import type { Pin } from "@/features/pins/types";

function StageDots({ active }: { active: number }) {
  return (
    <div className="stages">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`stage s${i}${i <= active ? "" : " off"}`}>
          {i}
        </span>
      ))}
    </div>
  );
}

function ColumnChip({ column }: { column: string }) {
  const map: Record<string, string> = {
    videos: "Videos",
    images: "Images",
    print: "Print",
    web: "Web",
    automation: "Automation",
  };
  const label = map[column];
  if (!label) return null;
  return <span className={`col-chip col-chip-${column}`}>{label}</span>;
}

/** Replicates legacy view2.js displayTags formula:
 *  [primaryFormatLabel, expectedClient[0]] — both uppercased, deduped, non-empty. */
function cardDisplayTags(pin: Pin): string[] {
  const format = (pin.subtype || "Video").toUpperCase();
  const client = (pin.expectedClient || [])[0]?.toUpperCase() ?? "";
  return [...new Set([format, client].filter(Boolean))];
}

export type PinCardVariant = "metrics" | "formats";

export function PinCard({
  pin,
  variant = "metrics",
  onExpand,
  onDuplicate,
  selectable = false,
  selected = false,
  onToggleSelect,
  onRemove,
}: {
  pin: Pin;
  variant?: PinCardVariant;
  onExpand: (pin: Pin) => void;
  onDuplicate: (pin: Pin) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (pin: Pin) => void;
  onRemove?: (pin: Pin) => void;
}) {
  const counts = formatAssetCounts(pin);
  const primary = primaryFormatKey(String(pin.column));

  return (
    <article
      className={`board-card${selected ? " is-selected" : ""}`}
      data-pin-id={pin.id}
      tabIndex={0}
      role="button"
      onClick={() => onExpand(pin)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onExpand(pin);
        }
      }}
    >
      <div className="card-top">
        <div className="card-title-wrap">
          {selectable ? (
            <label
              className="card-select"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggleSelect?.(pin)}
                aria-label={`Select ${pin.name}`}
              />
            </label>
          ) : null}
          <h2 className="card-title">{pin.name}</h2>
          {pin.showColumnChip ? <ColumnChip column={String(pin.column)} /> : null}
        </div>
        {pin.PM ? <span className="PM-badge">PM</span> : null}
      </div>
      <div className="tags">
        {cardDisplayTags(pin).map((t, i) => (
          <span key={`${t}-${i}`} className={`tag ${i === 0 ? "kit" : "neutral"}`}>
            {t}
          </span>
        ))}
      </div>
      <div className="card-actions">
        <button
          type="button"
          className="btn-state expand"
          onClick={(e) => {
            e.stopPropagation();
            onExpand(pin);
          }}
        >
          ⤢ Expand
        </button>
        <button
          type="button"
          className="btn-duplicate"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate(pin);
          }}
        >
          Duplicate
        </button>
        {onRemove ? (
          <button
            type="button"
            className="btn-remove"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(pin);
            }}
          >
            Remove
          </button>
        ) : null}
      </div>
      <div className="stats">
        {variant === "formats" ? (
          (["video", "image", "print", "web"] as const).map((key) => (
            <div
              key={key}
              className={`stat${key === primary ? " assets" : ""}`}
              data-format={key}
            >
              <span className="num">{counts[key] || 0}</span>
              <span className="label">{key.toUpperCase()}</span>
            </div>
          ))
        ) : (
          <>
            <div className="stat">
              <span className="num">{pin.hooks}</span>
              <span className="label">HOOKS</span>
            </div>
            <div className="stat">
              <span className="num">{pin.angles}</span>
              <span className="label">ANGLES</span>
            </div>
            <div className="stat">
              <span className="num">{pin.executions}</span>
              <span className="label">VARIATIONS</span>
            </div>
            <div className="stat assets">
              <span className="num">{pin.assets}</span>
              <span className="label">ASSETS</span>
            </div>
          </>
        )}
      </div>
      <div className="card-footer">
        <span className="star">★</span>
        <StageDots active={pin.stage || 1} />
        <span className="footer-label">{pin.footerLabel || pin.subtype}</span>
        <span className="pin-id">{pin.id}</span>
      </div>
    </article>
  );
}

/** All-pins directory row — matches legacy shared.js markup / app.css */
export function PinDirectoryRow({
  pin,
  onExpand,
  showColumnChip,
}: {
  pin: Pin;
  onExpand: (pin: Pin) => void;
  showColumnChip?: boolean;
}) {
  const clients = pin.expectedClient || [];
  return (
    <article
      className="pin-dir-row"
      data-pin-id={pin.id}
      tabIndex={0}
      role="button"
      onClick={() => onExpand(pin)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onExpand(pin);
        }
      }}
    >
      <div className="dir-top">
        <span className="dir-id">{pin.id}</span>
        <h3 className="dir-name">{pin.name}</h3>
        {showColumnChip || pin.showColumnChip ? (
          <ColumnChip column={String(pin.column)} />
        ) : (
          <span className="dir-branch">{pin.branch || "—"}</span>
        )}
      </div>
      <div className="dir-clients">
        <span className="dir-clients-label">Expected clients</span>
        <div className="dir-client-wrap">
          {clients.length ? (
            clients.map((c) => (
              <span key={c} className="dir-client">
                {c}
              </span>
            ))
          ) : (
            <span className="dir-client empty">No expected client</span>
          )}
        </div>
      </div>
    </article>
  );
}

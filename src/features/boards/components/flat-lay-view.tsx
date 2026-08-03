"use client";

import { resolveFlatNotesHtml } from "@/features/pins/lib/pin-utils";
import type { Pin } from "@/features/pins/types";

type FlatCol = { id: string; title: string; count: number };

type FlatLayViewProps = {
  columns: FlatCol[];
  activeId: string;
  pins: Pin[];
  onTabChange: (id: string) => void;
  onBack: () => void;
  onOpenPin: (pin: Pin) => void;
};

function FlatCard({ pin, onOpen }: { pin: Pin; onOpen: (p: Pin) => void }) {
  const tagGroups = [
    { label: "EXPECTED CLIENT", color: "blue", values: pin.expectedClient || [] },
    { label: "SELLING", color: "purple", values: pin.selling || [] },
    { label: "CREATIVE PACK", color: "blue", values: pin.creativePack || [] },
    { label: "FULL CAMPAIGN", color: "purple", values: pin.fullCampaign || [] },
    { label: "TALENT REQUIREMENTS", color: "purple", values: pin.talent || [] },
  ];
  const selectedCount = tagGroups.reduce((n, g) => n + g.values.length, 0);

  return (
    <article
      className="flat-card"
      data-pin-id={pin.id}
      tabIndex={0}
      role="button"
      onClick={() => onOpen(pin)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(pin);
      }}
    >
      <div className="flat-card-top">
        <div className="flat-card-ids">
          <span className="flat-id">{pin.id}</span>
          <span className="flat-star" aria-hidden="true">
            ★
          </span>
          <span className="flat-x" aria-hidden="true">
            ✕
          </span>
        </div>
        {pin.PM ? <span className="flat-PM">PM</span> : null}
      </div>
      <h3 className="flat-title">{pin.name}</h3>
      <div className="flat-stats">
        <div className="flat-stat">
          <span className="num">{pin.hooks || 0}</span>
          <span className="label">HOOKS</span>
        </div>
        <div className="flat-stat">
          <span className="num">{pin.angles || 0}</span>
          <span className="label">ANGLES</span>
        </div>
        <div className="flat-stat">
          <span className="num">{pin.executions || 0}</span>
          <span className="label">EXECUTIONS</span>
        </div>
        <div className="flat-stat is-assets">
          <span className="num">{pin.assets || 0}</span>
          <span className="label">ASSETS</span>
        </div>
      </div>
      <div className="flat-selects">
        <div className="flat-select">
          <span>{pin.branch || "—"}</span>
          <span className="chev">▾</span>
        </div>
        <div className="flat-select">
          <span>{pin.subtype || "—"}</span>
          <span className="chev">▾</span>
        </div>
      </div>
      <div className="flat-budget">
        <div className="flat-budget-field">
          <span className="blabel">LOWER</span>
          <span className="bvalue">
            {pin.lower || "₹0"} · custom <span className="chev">▾</span>
          </span>
        </div>
        <div className="flat-budget-field">
          <span className="blabel">HIGHER</span>
          <span className="bvalue">
            {pin.higher || "₹0"} · custom <span className="chev">▾</span>
          </span>
        </div>
      </div>
      <div className="flat-section flat-tags" data-flat-tags>
        <button
          type="button"
          className="flat-collapse-toggle"
          aria-expanded="false"
          onClick={(e) => {
            e.stopPropagation();
            const panel = e.currentTarget.nextElementSibling as HTMLElement | null;
            const open = panel?.hasAttribute("hidden") ?? true;
            if (panel) {
              if (open) panel.removeAttribute("hidden");
              else panel.setAttribute("hidden", "");
            }
            e.currentTarget.setAttribute("aria-expanded", open ? "true" : "false");
          }}
        >
          <span className="flat-collapse-label">TAGS</span>
          <span className="flat-collapse-meta">{selectedCount} selected</span>
          <span className="flat-collapse-chev" aria-hidden="true">
            ▾
          </span>
        </button>
        <div className="flat-tags-panel" hidden>
          {tagGroups.map((g) => (
            <div className="flat-tag-cat" key={g.label}>
              <div className="flat-tag-cat-label">{g.label}</div>
              <div className="flat-pills">
                {g.values.length ? (
                  g.values.map((t, ti) => (
                    <span key={`${t}__${ti}`} className={`flat-pill flat-pill-${g.color}`}>
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="flat-tag-empty-inline">None</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flat-section">
        <div className="flat-section-label">AWARENESS STAGE</div>
        <div className="flat-stages">
          {[1, 2, 3, 4, 5].map((i) => (
            <span key={i} className={`flat-stage s${i}${i <= (pin.stage || 0) ? " on" : ""}`}>
              {i}
            </span>
          ))}
        </div>
      </div>
      <div className="flat-notes">
        <div className="flat-notes-head">Formatted notes · click to edit</div>
        <div
          className="flat-notes-body"
          dangerouslySetInnerHTML={{ __html: resolveFlatNotesHtml(pin) }}
        />
      </div>
    </article>
  );
}

/** Flat-lay expanded column view — matches legacy renderFlatLayBoard markup. */
export function FlatLayView({
  columns,
  activeId,
  pins,
  onTabChange,
  onBack,
  onOpenPin,
}: FlatLayViewProps) {
  const active = columns.find((c) => c.id === activeId) || columns[0];
  if (!active) return <div className="empty-state">No column to expand.</div>;

  return (
    <div className="flatlay" data-expanded-col={active.id}>
      <div className="flatlay-tabs">
        <div className="flatlay-tabs-scroll">
          {columns.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`flatlay-tab${c.id === active.id ? " active" : ""}`}
              onClick={() => onTabChange(c.id)}
            >
              {c.title} ({c.count})
            </button>
          ))}
        </div>
      </div>
      <div className="flatlay-bar">
        <span className="flatlay-col-badge">{active.title.toUpperCase()}</span>
        <span className="flatlay-meta">
          {pins.length} Pin{pins.length === 1 ? "" : "s"} · Flat lay view
        </span>
        <span className="flatlay-spacer" />
        <button type="button" className="btn" onClick={onBack}>
          ← Back to col
        </button>
      </div>
      <div className="flatlay-track">
        {pins.length ? (
          pins.map((p, i) => <FlatCard key={`${p.id}__${i}`} pin={p} onOpen={onOpenPin} />)
        ) : (
          <div className="flatlay-empty">No pins in this column.</div>
        )}
      </div>
    </div>
  );
}

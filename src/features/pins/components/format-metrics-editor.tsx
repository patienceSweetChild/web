"use client";

import { useMemo, useState } from "react";
import type { FormatKey, Pin } from "@/features/pins/types";
import { primaryFormatKey } from "@/features/pins/lib/pin-utils";

export type PackKey = FormatKey;

const FORMAT_KEYS: PackKey[] = ["video", "image", "print", "web", "automation"];
const METRIC_ROLES = ["hooks", "angles", "executions", "assets"] as const;

const PACK_META: Record<
  PackKey,
  { chip: string; title: string; price: number }
> = {
  video: { chip: "Video", title: "UGC Video Pack", price: 45000 },
  image: { chip: "Image", title: "Feature-to-Benefit Image Pack", price: 35000 },
  print: { chip: "Print", title: "Print Poster Pack", price: 8000 },
  web: { chip: "Web", title: "Web Landing Pack", price: 65000 },
  automation: { chip: "Auto", title: "Automation Pack", price: 25000 },
};

const METRIC_LABELS: Record<(typeof METRIC_ROLES)[number], { label: string; sub: string }> = {
  hooks: { label: "Hooks", sub: "Hook Variations" },
  angles: { label: "Angles", sub: "Concept / Angle Variations" },
  executions: { label: "Variation", sub: "Variation Styles" },
  assets: { label: "Final Assets", sub: "Agreed Default Outputs" },
};

type FormatMetricsEditorProps = {
  draft: Pin;
  openFormats: Set<PackKey>;
  onToggleFormat: (key: PackKey) => void;
  onChangeMetric: (
    key: PackKey,
    role: (typeof METRIC_ROLES)[number],
    value: number
  ) => void;
};

function formatINR(n: number) {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}

export function readFormatMetric(
  draft: Pin,
  key: PackKey,
  role: (typeof METRIC_ROLES)[number]
) {
  const packs = draft.formatPacks || {};
  const pack = packs[key];
  if (pack && typeof pack[role] === "number") return pack[role] as number;
  if (role === "assets") {
    const fa = draft.formatAssets?.[key];
    if (typeof fa === "number") return fa;
    if (fa && typeof fa === "object") return fa.assets || 0;
  }
  if (key === primaryFormatKey(String(draft.column))) {
    return Number(draft[role]) || 0;
  }
  return 0;
}

export function applyFormatMetric(
  draft: Pin,
  key: PackKey,
  role: (typeof METRIC_ROLES)[number],
  value: number
): Pin {
  const formatPacks = { ...(draft.formatPacks || {}) };
  const current = {
    hooks: readFormatMetric(draft, key, "hooks"),
    angles: readFormatMetric(draft, key, "angles"),
    executions: readFormatMetric(draft, key, "executions"),
    assets: readFormatMetric(draft, key, "assets"),
    ...formatPacks[key],
    [role]: value,
  };
  formatPacks[key] = current;
  const formatAssets = { ...(draft.formatAssets || {}), [key]: current.assets };
  const primary = primaryFormatKey(String(draft.column));
  const patch: Partial<Pin> = { formatPacks, formatAssets };
  if (key === primary) {
    patch.hooks = current.hooks;
    patch.angles = current.angles;
    patch.executions = current.executions;
    patch.assets = current.assets;
  }
  return { ...draft, ...patch };
}

function packTitle(draft: Pin, key: PackKey) {
  return draft.name?.trim() || PACK_META[key].title;
}

function packPrice(draft: Pin, key: PackKey) {
  const raw = String(draft.lower || draft.price || "").replace(/[₹,\s]/g, "");
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return PACK_META[key].price;
}

/** Multi-format pack editor for parent-trusted boards (Core Pin Promise). */
export function FormatPackEditor({
  draft,
  openFormats,
  onToggleFormat,
  onChangeMetric,
}: FormatMetricsEditorProps) {
  const [expanded, setExpanded] = useState<Set<PackKey>>(new Set());

  const openList = useMemo(
    () => FORMAT_KEYS.filter((k) => openFormats.has(k)),
    [openFormats]
  );

  const totals = useMemo(() => {
    let hooks = 0;
    let angles = 0;
    let executions = 0;
    let assets = 0;
    let priceSum = 0;
    const prices: number[] = [];
    openList.forEach((key) => {
      hooks += readFormatMetric(draft, key, "hooks");
      angles += readFormatMetric(draft, key, "angles");
      executions += readFormatMetric(draft, key, "executions");
      assets += readFormatMetric(draft, key, "assets");
      const p = packPrice(draft, key);
      priceSum += p;
      prices.push(p);
    });
    const low = prices.length ? Math.min(...prices) : 0;
    const high = prices.length ? Math.max(...prices) : 0;
    return {
      hooks,
      angles,
      executions,
      assets,
      priceSum,
      range:
        !prices.length
          ? "—"
          : low === high
            ? formatINR(low)
            : `${formatINR(low)}–${formatINR(high)}+`,
      headerName:
        openList.length === 1
          ? packTitle(draft, openList[0]).toUpperCase()
          : openList.length
            ? `${openList.length} formats selected`
            : "All selected formats",
    };
  }, [draft, openList]);

  function autoAssets(key: PackKey) {
    const hooks = readFormatMetric(draft, key, "hooks");
    const angles = readFormatMetric(draft, key, "angles");
    const executions = readFormatMetric(draft, key, "executions");
    const parts = [hooks, angles, executions].filter((n) => n > 0);
    onChangeMetric(key, "assets", parts.length ? parts.reduce((a, b) => a * b, 1) : 0);
  }

  return (
    <div className="format-block">
      <div className="format-block-title">OUTPUT FORMATS</div>
      <div className="format-checks">
        {FORMAT_KEYS.map((key) => (
          <label className="format-check" key={key}>
            <input
              type="checkbox"
              checked={openFormats.has(key)}
              onChange={() => {
                onToggleFormat(key);
                if (openFormats.has(key)) {
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    next.delete(key);
                    return next;
                  });
                }
              }}
            />{" "}
            {key[0].toUpperCase() + key.slice(1)}
          </label>
        ))}
      </div>

      <div className={`va-shell${openList.length ? " open" : ""}`}>
        <div className="pack-header">
          <div>
            <div className="eyebrow">CORE PIN PROMISE</div>
            <h3>Variations &amp; Assets</h3>
            <p className="desc">
              These numbers become this master Pin&apos;s default promise inside a client
              project.
            </p>
          </div>
          <div className="pack-header-right">
            <input
              className="pack-total"
              type="number"
              min={0}
              value={totals.assets}
              readOnly
            />
            <div className="pack-name">{totals.headerName}</div>
          </div>
        </div>

        <div className="format-packs">
          {openList.map((key) => {
            const hooks = readFormatMetric(draft, key, "hooks");
            const angles = readFormatMetric(draft, key, "angles");
            const executions = readFormatMetric(draft, key, "executions");
            const assets = readFormatMetric(draft, key, "assets");
            const isExpanded = expanded.has(key);
            return (
              <div
                className={`format-pack open${isExpanded ? " expanded" : ""}`}
                key={key}
                id={`pack-${key}`}
              >
                <button
                  type="button"
                  className="format-pack-toggle"
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    })
                  }
                >
                  <span className="fmt-chip">{PACK_META[key].chip}</span>
                  <span className="fmt-title">{packTitle(draft, key)}</span>
                  <span className="fmt-summary">
                    H{hooks} · A{angles} · V{executions} · {assets} assets
                  </span>
                  <span className="fmt-chevron" aria-hidden="true">
                    ▾
                  </span>
                </button>
                <div className="pack-cards">
                  {METRIC_ROLES.map((role) => (
                    <div
                      className={`pack-card${role === "assets" ? " final" : ""}`}
                      key={role}
                    >
                      <div className="pc-label">{METRIC_LABELS[role].label}</div>
                      <input
                        className="pc-num"
                        type="number"
                        min={0}
                        value={readFormatMetric(draft, key, role)}
                        onChange={(e) =>
                          onChangeMetric(key, role, Number(e.target.value) || 0)
                        }
                      />
                      <div className="pc-sub">{METRIC_LABELS[role].sub}</div>
                      <div className="auto-slot">
                        {role === "assets" ? (
                          <button
                            className="auto-btn"
                            type="button"
                            onClick={() => autoAssets(key)}
                          >
                            AUTO
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="final-summary">
          <div className="final-summary-title">Final Summary</div>
          <div className="final-summary-grid">
            <div className="sum-field">
              <label>TOTAL HOOKS</label>
              <input type="number" value={totals.hooks} readOnly />
            </div>
            <div className="sum-field">
              <label>TOTAL ANGLES</label>
              <input type="number" value={totals.angles} readOnly />
            </div>
            <div className="sum-field">
              <label>TOTAL VARIATION</label>
              <input type="number" value={totals.executions} readOnly />
            </div>
            <div className="sum-field">
              <label>TOTAL ASSETS</label>
              <input type="number" value={totals.assets} readOnly />
            </div>
          </div>
          <div className="final-summary-grid secondary">
            <div className="sum-field">
              <label>FORMATS</label>
              <input type="text" value={`${openList.length} selected`} readOnly />
            </div>
            <div className="sum-field">
              <label>COMBINED PRICE</label>
              <input type="text" value={formatINR(totals.priceSum)} readOnly />
            </div>
            <div className="sum-field">
              <label>COMBINED RANGE</label>
              <input type="text" value={totals.range} readOnly />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Child boards no longer show a standalone metrics block. */
export function SimpleMetricsEditor({
  draft,
  onChange,
}: {
  draft: Pin;
  onChange: (role: (typeof METRIC_ROLES)[number], value: number) => void;
}) {
  return (
    <div className="va-shell open">
      <div className="section-label">METRICS</div>
      <div className="format-pack open">
        <div className="format-pack-body">
          {METRIC_ROLES.map((role) => (
            <label key={role}>
              {role}
              <input
                type="number"
                min={0}
                value={Number(draft[role]) || 0}
                onChange={(e) => onChange(role, Number(e.target.value) || 0)}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export { FORMAT_KEYS, METRIC_ROLES, PACK_META };

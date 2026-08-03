"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  MONTH_SHORT,
  currentMetricsPeriod,
  formatPeriodLabel,
  formatPeriodTitle,
  type MetricsPeriod,
  type PeriodGranularity,
} from "@/features/users/lib/metrics-period";

const GRANULARITIES: { id: PeriodGranularity; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "quarter", label: "Quarter" },
  { id: "year", label: "Year" },
];

export function MetricsPeriodPicker({
  value,
  onChange,
}: {
  value: MetricsPeriod;
  onChange: (next: MetricsPeriod) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const [browseYear, setBrowseYear] = useState(value.year);

  useEffect(() => {
    if (open) setBrowseYear(value.year);
  }, [open, value.year]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const now = currentMetricsPeriod();

  function selectGranularity(g: PeriodGranularity) {
    onChange({
      ...value,
      granularity: g,
      quarter: Math.floor(value.month / 3),
    });
  }

  function selectMonth(month: number) {
    onChange({
      granularity: "month",
      year: browseYear,
      month,
      quarter: Math.floor(month / 3),
    });
    setOpen(false);
  }

  function selectQuarter(quarter: number) {
    onChange({
      granularity: "quarter",
      year: browseYear,
      quarter,
      month: quarter * 3,
    });
    setOpen(false);
  }

  function selectYear(year: number) {
    onChange({
      granularity: "year",
      year,
      month: value.month,
      quarter: value.quarter,
    });
    setOpen(false);
  }

  function jumpToCurrent() {
    onChange(currentMetricsPeriod());
    setBrowseYear(now.year);
    setOpen(false);
  }

  const yearOptions = Array.from({ length: 7 }, (_, i) => now.year - 3 + i);

  return (
    <div className="metrics-period" ref={rootRef}>
      <button
        type="button"
        className={`metrics-period-trigger${open ? " open" : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        title={formatPeriodTitle(value)}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="metrics-period-ico" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
            <path d="M1.5 6h13" stroke="currentColor" strokeWidth="1.25" />
            <path d="M5 1.5v2M11 1.5v2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
          </svg>
        </span>
        <span className="metrics-period-label">{formatPeriodLabel(value)}</span>
        <span className="metrics-period-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          className="metrics-period-panel"
          role="dialog"
          aria-label="Select metrics period"
        >
          <div className="metrics-period-modes" role="tablist" aria-label="Period type">
            {GRANULARITIES.map((g) => (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={value.granularity === g.id}
                className={`metrics-period-mode${value.granularity === g.id ? " active" : ""}`}
                onClick={() => selectGranularity(g.id)}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="metrics-period-nav">
            <button
              type="button"
              className="metrics-period-nav-btn"
              aria-label="Previous year"
              onClick={() => setBrowseYear((y) => y - 1)}
            >
              ‹
            </button>
            <span className="metrics-period-nav-year">{browseYear}</span>
            <button
              type="button"
              className="metrics-period-nav-btn"
              aria-label="Next year"
              onClick={() => setBrowseYear((y) => y + 1)}
            >
              ›
            </button>
          </div>

          {value.granularity === "month" && (
            <div className="metrics-period-grid months" role="listbox" aria-label="Month">
              {MONTH_SHORT.map((label, month) => {
                const selected =
                  value.granularity === "month" &&
                  value.year === browseYear &&
                  value.month === month;
                const isCurrent = now.year === browseYear && now.month === month;
                return (
                  <button
                    key={label}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`metrics-period-cell${selected ? " selected" : ""}${isCurrent ? " current" : ""}`}
                    onClick={() => selectMonth(month)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {value.granularity === "quarter" && (
            <div className="metrics-period-grid quarters" role="listbox" aria-label="Quarter">
              {[0, 1, 2, 3].map((q) => {
                const selected =
                  value.granularity === "quarter" &&
                  value.year === browseYear &&
                  value.quarter === q;
                const isCurrent = now.year === browseYear && now.quarter === q;
                const start = q * 3;
                return (
                  <button
                    key={q}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`metrics-period-cell${selected ? " selected" : ""}${isCurrent ? " current" : ""}`}
                    onClick={() => selectQuarter(q)}
                  >
                    <span className="metrics-period-q">Q{q + 1}</span>
                    <span className="metrics-period-q-range">
                      {MONTH_SHORT[start]}–{MONTH_SHORT[start + 2]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {value.granularity === "year" && (
            <div className="metrics-period-grid years" role="listbox" aria-label="Year">
              {yearOptions.map((y) => {
                const selected = value.granularity === "year" && value.year === y;
                const isCurrent = now.year === y;
                return (
                  <button
                    key={y}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`metrics-period-cell${selected ? " selected" : ""}${isCurrent ? " current" : ""}`}
                    onClick={() => {
                      setBrowseYear(y);
                      selectYear(y);
                    }}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          )}

          <div className="metrics-period-footer">
            <button type="button" className="metrics-period-today" onClick={jumpToCurrent}>
              This month
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

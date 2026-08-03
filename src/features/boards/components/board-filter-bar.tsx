"use client";

import { useMemo, useState } from "react";
import {
  BOARD_FILTER_ROWS,
  FORMAT_BRANCH_CHIPS,
  type FilterRowKey,
} from "@/features/boards/config";
import { activeFilterCount, emptyPinFilters, type PinFilterState } from "@/features/pins/lib/filters";
import { usePinCatalog } from "@/features/pins/store/pin-catalog-provider";
import type { BoardId } from "@/features/pins/types";
import { FilterChip, SearchAutocomplete, type SearchSuggestion } from "@/shared/ui";

export type FilterRowConfig = {
  key: FilterRowKey;
  label: string;
  options: string[];
};

type BoardFilterBarProps = {
  boardId: BoardId;
  query: string;
  onQueryChange: (q: string) => void;
  filters: PinFilterState;
  onFiltersChange: (f: PinFilterState) => void;
  resultCount: number;
  searchPlaceholder?: string;
  resultLabel?: string;
  toolbarExtra?: React.ReactNode;
  /** Override auto-built rows from BOARD_FILTER_ROWS when needed. */
  filterRows?: FilterRowConfig[];
  /** Selected format-column ids (videos / images / …). */
  branchFilter?: Set<string>;
  onBranchFilterChange?: (s: Set<string>) => void;
};

export function BoardFilterBar({
  boardId,
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  resultCount,
  searchPlaceholder = "Search board",
  resultLabel = "pins",
  toolbarExtra,
  filterRows,
  branchFilter,
  onBranchFilterChange,
}: BoardFilterBarProps) {
  const { catalogs, pins } = usePinCatalog();
  /** Legacy boards start with filters panel hidden. */
  const [open, setOpen] = useState(false);

  const pinNameOptions = useMemo(
    () =>
      Array.from(new Set(pins.map((p) => p.name).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [pins]
  );

  const searchSuggestions = useMemo((): SearchSuggestion[] => {
    const out: SearchSuggestion[] = [];
    const seen = new Set<string>();
    const add = (label: string, meta: string) => {
      const key = label.toLowerCase();
      if (!label || seen.has(key)) return;
      seen.add(key);
      out.push({ id: `${meta}:${label}`, label, meta });
    };
    for (const p of pins) {
      add(p.name, "Pin");
      if (p.id) add(p.id, "Pin ID");
    }
    for (const c of catalogs.expectedClients) add(c, "Client");
    for (const s of catalogs.sellingOptions) add(s, "Channel");
    for (const c of catalogs.creativePackOptions) add(c, "Pack");
    return out;
  }, [pins, catalogs]);

  const rows = useMemo((): FilterRowConfig[] => {
    if (filterRows) return filterRows;
    return BOARD_FILTER_ROWS[boardId].map((row) => {
      if (row.key === "branch") {
        return { ...row, options: FORMAT_BRANCH_CHIPS.map((b) => b.id) };
      }
      if (row.key === "pinNames") {
        return { ...row, options: pinNameOptions };
      }
      if (row.key === "expectedClient") {
        return { ...row, options: catalogs.expectedClients };
      }
      if (row.key === "selling") {
        return { ...row, options: catalogs.sellingOptions };
      }
      if (row.key === "creativePack") {
        return { ...row, options: catalogs.creativePackOptions };
      }
      return { ...row, options: catalogs.fullCampaignOptions };
    });
  }, [boardId, filterRows, catalogs, pinNameOptions]);

  const count = useMemo(() => {
    let n = activeFilterCount(filters);
    if (branchFilter?.size) n += branchFilter.size;
    return n;
  }, [filters, branchFilter]);

  function toggleFilter(key: keyof PinFilterState, value: string) {
    const next = new Set(filters[key]);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onFiltersChange({ ...filters, [key]: next });
  }

  function toggleBranch(value: string) {
    if (!onBranchFilterChange || !branchFilter) return;
    const next = new Set(branchFilter);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onBranchFilterChange(next);
  }

  return (
    <>
      <div className="filter-toolbar">
        <SearchAutocomplete
          value={query}
          onChange={onQueryChange}
          suggestions={searchSuggestions}
          placeholder={searchPlaceholder}
          recentKey={`ac:board:${boardId}`}
        />
        {toolbarExtra}
        <button
          type="button"
          className={`filter-toggle${open ? " active" : ""}`}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide filters" : "Show filters"}
          {count ? ` (${count})` : ""}
        </button>
        <div className="filter-meta-inline">
          <span>
            {resultCount} {resultLabel}
          </span>
          <button
            type="button"
            className="clear-filters"
            onClick={() => {
              onQueryChange("");
              onFiltersChange(emptyPinFilters());
              onBranchFilterChange?.(new Set());
            }}
          >
            Clear filters
          </button>
        </div>
      </div>
      <section className={`filters${open ? "" : " hidden"}`}>
        {rows.map((row) => {
          if (row.key === "branch") {
            const selected = branchFilter || new Set();
            return (
              <div className="filter-row" key="branch">
                <div className="filter-label">{row.label}</div>
                <div className="filter-chips">
                  {FORMAT_BRANCH_CHIPS.map((b) => (
                    <FilterChip
                      key={b.id}
                      active={selected.has(b.id)}
                      className={`branch-${b.id}`}
                      onClick={() => toggleBranch(b.id)}
                    >
                      <span className="chip-dot" style={{ background: b.color }} />
                      {b.label}
                    </FilterChip>
                  ))}
                </div>
              </div>
            );
          }
          const selected = filters[row.key];
          return (
            <div className="filter-row" key={row.key}>
              <div className="filter-label">{row.label}</div>
              <div className="filter-chips">
                {row.options.map((opt) => (
                  <FilterChip
                    key={opt}
                    active={selected.has(opt)}
                    onClick={() => toggleFilter(row.key as keyof PinFilterState, opt)}
                  >
                    {opt}
                  </FilterChip>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}

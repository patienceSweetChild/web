"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export type SearchSuggestion = {
  id: string;
  label: string;
  /** Secondary text shown on the right (Amazon-style). */
  meta?: string;
};

function normalizeSuggestions(
  suggestions: Array<SearchSuggestion | string>
): SearchSuggestion[] {
  return suggestions.map((s, i) =>
    typeof s === "string" ? { id: `s-${i}-${s}`, label: s } : s
  );
}

/** Rank: prefix matches first, then substring; stable within rank. */
export function rankSuggestions(
  suggestions: Array<SearchSuggestion | string>,
  query: string,
  limit = 8
): SearchSuggestion[] {
  const q = query.trim().toLowerCase();
  const list = normalizeSuggestions(suggestions);
  if (!q) return list.slice(0, limit);

  const scored: { item: SearchSuggestion; score: number; idx: number }[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const label = item.label.toLowerCase();
    const meta = (item.meta ?? "").toLowerCase();
    let score = -1;
    if (label === q) score = 0;
    else if (label.startsWith(q)) score = 1;
    else if (label.includes(q)) score = 2;
    else if (meta.startsWith(q)) score = 3;
    else if (meta.includes(q)) score = 4;
    if (score >= 0) scored.push({ item, score, idx: i });
  }
  scored.sort((a, b) => a.score - b.score || a.idx - b.idx);
  const out: SearchSuggestion[] = [];
  const seen = new Set<string>();
  for (const s of scored) {
    const key = s.item.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s.item);
    if (out.length >= limit) break;
  }
  return out;
}

function highlightMatch(label: string, query: string) {
  const q = query.trim();
  if (!q) return label;
  const i = label.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return label;
  return (
    <>
      {label.slice(0, i)}
      <mark className="ac-mark">{label.slice(i, i + q.length)}</mark>
      {label.slice(i + q.length)}
    </>
  );
}

function readRecent(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string").slice(0, 8);
  } catch {
    return [];
  }
}

function writeRecent(key: string, value: string) {
  const next = [value, ...readRecent(key).filter((x) => x !== value)].slice(0, 8);
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

type SearchAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  suggestions: Array<SearchSuggestion | string>;
  placeholder?: string;
  /** Applied to the outer wrap (default: search-wrap). */
  wrapClassName?: string;
  /** Applied to the input (default: search). */
  inputClassName?: string;
  maxSuggestions?: number;
  autoFocus?: boolean;
  /** Persist & show recent queries under this key. */
  recentKey?: string;
  /**
   * When the query is empty: show recent searches (default) or the
   * full suggestion list (client-side only — no fetch).
   */
  emptyMode?: "recent" | "suggestions";
  /** Called when a suggestion is chosen (after onChange). */
  onSelect?: (suggestion: SearchSuggestion) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
};

export function SearchAutocomplete({
  value,
  onChange,
  suggestions,
  placeholder = "Search…",
  wrapClassName = "search-wrap",
  inputClassName = "search",
  maxSuggestions = 8,
  autoFocus = false,
  recentKey,
  emptyMode = "recent",
  onSelect,
  disabled = false,
  id,
  "aria-label": ariaLabel,
}: SearchAutocompleteProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recents, setRecents] = useState<string[]>([]);

  const ranked = useMemo(
    () => rankSuggestions(suggestions, value, maxSuggestions),
    [suggestions, value, maxSuggestions]
  );

  const recentItems = useMemo((): SearchSuggestion[] => {
    if (!recentKey || value.trim() || emptyMode !== "recent") return [];
    return recents
      .filter((r) => r.trim())
      .slice(0, maxSuggestions)
      .map((r) => ({ id: `recent:${r}`, label: r, meta: "Recent" }));
  }, [recentKey, value, recents, maxSuggestions, emptyMode]);

  const items = value.trim()
    ? ranked
    : emptyMode === "suggestions"
      ? ranked
      : recentItems;
  const showPanel = open && items.length > 0;

  useEffect(() => {
    if (!recentKey) return;
    void Promise.resolve().then(() => setRecents(readRecent(recentKey)));
  }, [recentKey]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const commit = useCallback(
    (item: SearchSuggestion) => {
      onChange(item.label);
      onSelect?.(item);
      if (recentKey && item.label.trim()) {
        writeRecent(recentKey, item.label.trim());
        setRecents(readRecent(recentKey));
      }
      setOpen(false);
      setActiveIndex(-1);
    },
    [onChange, onSelect, recentKey]
  );

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showPanel && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      if (items.length) {
        setOpen(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }
    if (!showPanel) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      commit(items[activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div
      className={`ac-root${wrapClassName ? ` ${wrapClassName}` : ""}`}
      ref={rootRef}
      role="combobox"
      aria-expanded={showPanel}
      aria-haspopup="listbox"
      aria-owns={showPanel ? listId : undefined}
    >
      <span className="search-ico" aria-hidden>
        ⌕
      </span>
      <input
        id={id}
        className={inputClassName}
        type="search"
        role="searchbox"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={ariaLabel ?? placeholder}
        aria-autocomplete="list"
        aria-controls={showPanel ? listId : undefined}
        aria-activedescendant={
          showPanel && activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
        }
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => {
          setOpen(true);
          if (recentKey) setRecents(readRecent(recentKey));
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (recentKey && value.trim()) {
            writeRecent(recentKey, value.trim());
          }
        }}
      />
      {showPanel ? (
        <ul id={listId} className="ac-panel" role="listbox">
          {items.map((item, i) => (
            <li key={item.id} role="presentation">
              <button
                type="button"
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                className={`ac-option${i === activeIndex ? " active" : ""}`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(item);
                }}
              >
                <span className="ac-option-ico" aria-hidden>
                  {item.id.startsWith("recent:") ? "◷" : "⌕"}
                </span>
                <span className="ac-option-label">
                  {highlightMatch(item.label, value)}
                </span>
                {item.meta ? <span className="ac-option-meta">{item.meta}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

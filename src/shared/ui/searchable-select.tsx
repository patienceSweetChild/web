"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export type SearchableSelectOption = {
  id: string;
  label: string;
  meta?: string;
};

type SearchableSelectProps = {
  value: string;
  options: SearchableSelectOption[];
  onChange: (id: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  "aria-label"?: string;
};

function filterOptions(
  options: SearchableSelectOption[],
  query: string
): SearchableSelectOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter(
    (o) =>
      o.label.toLowerCase().includes(q) ||
      (o.meta?.toLowerCase().includes(q) ?? false)
  );
}

/**
 * Single combobox: click opens the list, typing filters it in place.
 * Filters client-side only — no network calls.
 */
export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = "Search…",
  emptyLabel = "— None —",
  disabled = false,
  autoFocus = false,
  "aria-label": ariaLabel,
}: SearchableSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = options.find((o) => o.id === value) ?? null;

  const filtered = useMemo(
    () => filterOptions(options, query),
    [options, query]
  );

  // None + filtered rows for keyboard nav
  const rows = useMemo(
    () => [{ id: "", label: emptyLabel }, ...filtered],
    [filtered, emptyLabel]
  );

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
  }, [query, open]);

  function openList() {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    setActiveIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function commit(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % rows.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? rows.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[activeIndex];
      if (row) commit(row.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
    }
  }

  const display = open
    ? query
    : selected
      ? selected.label
      : "";

  return (
    <div
      className={`ss-root${open ? " open" : ""}`}
      ref={rootRef}
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-owns={open ? listId : undefined}
    >
      <div className="ss-control" onClick={openList}>
        <input
          ref={inputRef}
          className="ss-input"
          type="text"
          role="searchbox"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={selected && !open ? undefined : placeholder}
          value={display}
          aria-label={ariaLabel ?? placeholder}
          aria-autocomplete="list"
          aria-controls={open ? listId : undefined}
          aria-activedescendant={
            open ? `${listId}-opt-${activeIndex}` : undefined
          }
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            if (!open) openList();
          }}
          onKeyDown={onKeyDown}
          onClick={(e) => {
            e.stopPropagation();
            if (!open) openList();
          }}
        />
        <span className="ss-chevron" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </div>

      {open ? (
        <ul id={listId} className="ss-panel" role="listbox">
          {rows.length === 1 && filtered.length === 0 ? (
            <>
              <li role="presentation">
                <button
                  type="button"
                  id={`${listId}-opt-0`}
                  role="option"
                  aria-selected={activeIndex === 0}
                  className={`ss-option${activeIndex === 0 ? " active" : ""}`}
                  onMouseEnter={() => setActiveIndex(0)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit("");
                  }}
                >
                  {emptyLabel}
                </button>
              </li>
              <li className="ss-empty">No matches</li>
            </>
          ) : (
            rows.map((row, i) => (
              <li key={row.id || "__none"} role="presentation">
                <button
                  type="button"
                  id={`${listId}-opt-${i}`}
                  role="option"
                  aria-selected={
                    row.id === value || (row.id === "" && !value)
                  }
                  className={`ss-option${i === activeIndex ? " active" : ""}${
                    row.id === value || (row.id === "" && !value)
                      ? " selected"
                      : ""
                  }`}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(row.id);
                  }}
                >
                  <span className="ss-option-label">{row.label}</span>
                  {row.meta ? (
                    <span className="ss-option-meta">{row.meta}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

"use client";

import { SearchAutocomplete } from "@/shared/ui";

type PinAttachModalProps = {
  open: boolean;
  title?: string;
  searchPlaceholder?: string;
  query: string;
  onQueryChange: (q: string) => void;
  items: { id: string; name: string; meta?: string }[];
  emptyText?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
};

/** Matches legacy picker-backdrop / picker-modal markup from board-*.html */
export function PinAttachModal({
  open,
  title = "Add existing pin",
  searchPlaceholder = "Search pins…",
  query,
  onQueryChange,
  items,
  emptyText = "No matching pins.",
  onSelect,
  onClose,
}: PinAttachModalProps) {
  if (!open) return null;

  return (
    <div
      className="picker-backdrop open"
      aria-hidden="false"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="picker-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pickerTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="picker-head">
          <h2 id="pickerTitle">{title}</h2>
          <button
            type="button"
            className="btn btn-ghost picker-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <SearchAutocomplete
          wrapClassName="search-wrap picker-search"
          value={query}
          onChange={onQueryChange}
          suggestions={items.map((item) => ({
            id: item.id,
            label: item.name,
            meta: item.meta === "client-only" ? undefined : item.id,
          }))}
          placeholder={searchPlaceholder}
          autoFocus
          recentKey="ac:pin-attach"
        />
        <div className="picker-list">
          {!items.length ? (
            <div className="picker-empty">{emptyText}</div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="picker-item"
                onClick={() => onSelect(item.id)}
              >
                {item.meta !== "client-only" ? (
                  <span className="picker-item-id">{item.id}</span>
                ) : null}
                <span className="picker-item-name">{item.name}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

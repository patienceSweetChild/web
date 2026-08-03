"use client";

import Link from "next/link";

function focusPageSearch() {
  const el = document.querySelector<HTMLInputElement>(
    ".main input.search, .main .search, .topbar input.search, .content input.search"
  );
  if (!el) return;
  el.focus();
  el.select?.();
}

/** Search + Create actions on the dark rail (labels expand on rail hover). */
export function RailQuickActions({
  onCreate,
  canCreate = false,
  createHref = "/boards/catalog",
}: {
  onCreate?: () => void;
  canCreate?: boolean;
  /** Used when canCreate but no onCreate handler (e.g. workspace pages). */
  createHref?: string;
}) {
  const showCreate = canCreate || Boolean(onCreate);

  return (
    <div className="rail-quick-actions" aria-label="Quick actions">
      <button
        type="button"
        className="rail-nav-item"
        onClick={focusPageSearch}
        title="Search"
        aria-label="Search"
      >
        <span className="rail-nav-ico" aria-hidden>
          ⌕
        </span>
        <span className="rail-nav-label">Search</span>
      </button>

      {showCreate &&
        (onCreate ? (
          <button
            type="button"
            className="rail-nav-item"
            onClick={onCreate}
            title="Create pin"
            aria-label="Create pin"
          >
            <span className="rail-nav-ico" aria-hidden>
              +
            </span>
            <span className="rail-nav-label">Create pin</span>
          </button>
        ) : (
          <Link
            href={createHref}
            className="rail-nav-item"
            title="Create pin"
            aria-label="Create pin"
          >
            <span className="rail-nav-ico" aria-hidden>
              +
            </span>
            <span className="rail-nav-label">Create pin</span>
          </Link>
        ))}
    </div>
  );
}

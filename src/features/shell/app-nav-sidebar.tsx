"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BOARD_NAV } from "@/features/boards/config";
import { usePinCatalog } from "@/features/pins/store/pin-catalog-provider";
import type { Profile } from "@/features/users/types";

/** Always-visible boards list (sticky in the light sidebar). */
export function BoardsNavSection() {
  const pathname = usePathname();

  return (
    <div className="boards-nav-section">
      <div className="nav-section-label">Boards</div>
      <div className="nav-section-body">
        {BOARD_NAV.map((item) => (
          <Link
            key={item.href}
            className={`nav-link${pathname === item.href ? " active" : ""}`}
            href={item.href}
          >
            <span className="ico">{item.icon}</span> {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AppNavSidebar({
  projectType,
  sidebarExtra,
  collapsed = false,
  onToggleCollapse,
}: {
  profile?: Profile | null;
  unreadCount?: number;
  projectType?: string;
  sidebarExtra?: React.ReactNode;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** @deprecated Workspace moved to the dark rail; ignored. */
  forceBoardsCollapsed?: boolean;
}) {
  const { backend, ready } = usePinCatalog();

  const typeLabel =
    projectType ??
    (ready
      ? backend === "supabase"
        ? "Software project · Supabase"
        : "Software project"
      : "Loading…");

  return (
    <aside
      className={`sidebar${collapsed ? " is-collapsed" : ""}`}
      aria-label="Library"
    >
      {collapsed ? (
        <button
          type="button"
          className="sidebar-collapse-btn sidebar-expand-only"
          onClick={onToggleCollapse}
          aria-expanded={false}
          aria-label="Expand library sidebar"
          title="Expand library"
        >
          »
        </button>
      ) : (
        <>
          <div className="project-block">
            <div className="project-avatar">OAS</div>
            <div className="project-block-text">
              <div className="project-name">OAS Pin Library</div>
              <div className="project-type">{typeLabel}</div>
            </div>
            {onToggleCollapse ? (
              <button
                type="button"
                className="sidebar-collapse-btn"
                onClick={onToggleCollapse}
                aria-expanded
                aria-label="Collapse library sidebar"
                title="Collapse library"
              >
                «
              </button>
            ) : null}
          </div>

          <BoardsNavSection />

          {sidebarExtra}
        </>
      )}
    </aside>
  );
}

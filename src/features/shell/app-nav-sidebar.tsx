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
  profile,
  projectType,
  sidebarExtra,
}: {
  profile?: Profile | null;
  unreadCount?: number;
  projectType?: string;
  sidebarExtra?: React.ReactNode;
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
    <aside className="sidebar">
      <div className="project-block">
        <div className="project-avatar">OAS</div>
        <div>
          <div className="project-name">OAS Pin Library</div>
          <div className="project-type">{typeLabel}</div>
        </div>
      </div>

      <BoardsNavSection />

      {sidebarExtra}
    </aside>
  );
}

"use client";

import Link from "next/link";
import type { BoardId } from "@/features/pins/types";
import type { UserRole, Profile } from "@/features/users/types";
import { ROLE_LABELS, ROLE_COLORS } from "@/features/users/types";
import { AppNavSidebar } from "./app-nav-sidebar";
import { GlobalRail } from "./global-rail";
import { NotificationBell } from "./notification-bell";
import { PageBreadcrumb, type Crumb } from "./page-breadcrumb";
import { RailQuickActions } from "./rail-quick-actions";
import { useShellSidebars } from "./use-shell-sidebars";

export function AppShell({
  title,
  crumbs,
  boardId,
  children,
  onCreatePin,
  primaryLabel = "+ Pin",
  onPrimaryAction,
  topExtra,
  profile,
  unreadCount = 0,
  canCreatePin = false,
  showPrimary,
}: {
  title: string;
  crumbs?: Crumb[];
  boardId: BoardId;
  children: React.ReactNode;
  onCreatePin?: () => void;
  primaryLabel?: string;
  onPrimaryAction?: () => void;
  topExtra?: React.ReactNode;
  profile?: Profile | null;
  unreadCount?: number;
  canCreatePin?: boolean;
  /** When set, controls topbar primary visibility separately from rail create. */
  showPrimary?: boolean;
}) {
  const primary = onPrimaryAction || onCreatePin;
  const showTopPrimary = showPrimary ?? canCreatePin;
  const role = profile?.role as UserRole | undefined;
  const roleColors = role ? ROLE_COLORS[role] : ROLE_COLORS.viewer;
  const createLabel = boardId === "sell-channels" ? "Create pack" : "Create pin";
  const resolvedPrimaryLabel =
    primaryLabel !== "+ Pin"
      ? primaryLabel
      : boardId === "sell-channels"
        ? "+ Pack"
        : primaryLabel;
  const {
    workspaceCollapsed,
    libraryCollapsed,
    toggleWorkspace,
    toggleLibrary,
  } = useShellSidebars();

  return (
    <div
      className="app"
      data-board-id={boardId}
      data-rail-collapsed={workspaceCollapsed ? "true" : "false"}
      data-sidebar-collapsed={libraryCollapsed ? "true" : "false"}
    >
      <GlobalRail
        profile={profile}
        unreadCount={unreadCount}
        collapsed={workspaceCollapsed}
        onToggleCollapse={toggleWorkspace}
      >
        <RailQuickActions
          canCreate={canCreatePin}
          onCreate={canCreatePin ? onCreatePin : undefined}
          createLabel={createLabel}
        />
      </GlobalRail>

      <AppNavSidebar
        profile={profile}
        unreadCount={unreadCount}
        collapsed={libraryCollapsed}
        onToggleCollapse={toggleLibrary}
      />

      <div className="main">
        <header className="topbar">
          <div className="page-heading">
            {crumbs && crumbs.length > 0 ? <PageBreadcrumb items={crumbs} /> : null}
            <h1 className="page-title">{title}</h1>
          </div>
          <div className="top-actions">
            <NotificationBell />
            {profile ? (
              <Link href="/profile" className="user-chip-link">
                <span
                  className="user-chip user-chip-role"
                  style={{
                    background: roleColors.bg,
                    color: roleColors.text,
                    border: `1px solid ${roleColors.border}`,
                  }}
                >
                  <span className="user-chip-name">
                    {profile.full_name || profile.email.split("@")[0]}
                  </span>
                  <span className="user-chip-dot">·</span>
                  <span className="user-chip-role-label">
                    {role ? ROLE_LABELS[role] : "User"}
                  </span>
                </span>
              </Link>
            ) : (
              <span className="user-chip">
                <Link href="/login">Sign in</Link>
              </span>
            )}

            {topExtra}

            {showTopPrimary && primary && (
              <button type="button" className="btn btn-primary" onClick={primary}>
                {resolvedPrimaryLabel}
              </button>
            )}

            <button type="button" className="btn" disabled title="Coming soon">
              Export
            </button>
            <button type="button" className="btn btn-ghost" title="More">
              ···
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import type { BoardId } from "@/features/pins/types";
import type { UserRole, Profile } from "@/features/users/types";
import { ROLE_LABELS, ROLE_COLORS } from "@/features/users/types";
import { AppNavSidebar } from "./app-nav-sidebar";
import { PageBreadcrumb, type Crumb } from "./page-breadcrumb";
import { RailQuickActions } from "./rail-quick-actions";
import { WorkspaceRail } from "./workspace-rail";

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
}) {
  const primary = onPrimaryAction || onCreatePin;
  const role = profile?.role as UserRole | undefined;
  const roleColors = role ? ROLE_COLORS[role] : ROLE_COLORS.viewer;

  return (
    <div className="app" data-board-id={boardId}>
      <aside className="rail" aria-label="Global">
        <Link className="rail-logo" href="/boards/catalog" title="OAS">
          O
        </Link>
        <RailQuickActions
          canCreate={canCreatePin}
          onCreate={canCreatePin ? onCreatePin : undefined}
        />
        <WorkspaceRail profile={profile} unreadCount={unreadCount} />
        <div className="rail-spacer" />
        {profile ? (
          <Link className="rail-btn" href="/profile" title="My profile">
            <span className="rail-avatar">
              {(profile.full_name || profile.email)[0].toUpperCase()}
            </span>
          </Link>
        ) : (
          <Link className="rail-btn" href="/login" title="Sign in">
            ?
          </Link>
        )}
      </aside>

      <AppNavSidebar profile={profile} unreadCount={unreadCount} />

      <div className="main">
        <header className="topbar">
          <div className="page-heading">
            {crumbs && crumbs.length > 0 ? <PageBreadcrumb items={crumbs} /> : null}
            <h1 className="page-title">{title}</h1>
          </div>
          <div className="top-actions">
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

            {canCreatePin && (
              <button type="button" className="btn btn-primary" onClick={primary}>
                {primaryLabel}
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

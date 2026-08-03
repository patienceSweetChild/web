"use client";

import Link from "next/link";
import type { Profile, UserRole } from "@/features/users/types";
import { ROLE_LABELS, ROLE_COLORS } from "@/features/users/types";
import { useUser } from "@/features/users/user-provider";
import { useEffectiveBoardPermissions } from "@/features/boards/hooks/use-effective-board-permissions";
import { AppNavSidebar } from "./app-nav-sidebar";
import { PageBreadcrumb, type Crumb } from "./page-breadcrumb";
import { RailQuickActions } from "./rail-quick-actions";
import { WorkspaceRail } from "./workspace-rail";

export function WorkspaceShell({
  title,
  crumbs,
  children,
  topExtra,
  sidebarExtra,
  projectType,
  profile: profileProp,
}: {
  title: string;
  crumbs?: Crumb[];
  children: React.ReactNode;
  topExtra?: React.ReactNode;
  sidebarExtra?: React.ReactNode;
  projectType?: string;
  profile?: Profile | null;
}) {
  const { profile: ctxProfile, unreadCount } = useUser();
  const profile = profileProp ?? ctxProfile;
  const role = profile?.role as UserRole | undefined;
  const roleColors = role ? ROLE_COLORS[role] : ROLE_COLORS.viewer;
  const catalogPerms = useEffectiveBoardPermissions("catalog");

  return (
    <div className="app" data-board-id="workspace">
      <aside className="rail" aria-label="Global">
        <Link className="rail-logo" href="/boards/catalog" title="OAS">
          O
        </Link>
        <RailQuickActions canCreate={catalogPerms.can_create} />
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

      <AppNavSidebar
        profile={profile}
        unreadCount={unreadCount}
        projectType={projectType}
        sidebarExtra={sidebarExtra}
      />

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
            ) : null}
            {topExtra}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

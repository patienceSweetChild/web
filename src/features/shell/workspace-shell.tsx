"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Profile, UserRole } from "@/features/users/types";
import { ROLE_LABELS, ROLE_COLORS } from "@/features/users/types";
import { useUser } from "@/features/users/user-provider";
import { useEffectiveBoardPermissions } from "@/features/boards/hooks/use-effective-board-permissions";
import { AppNavSidebar } from "./app-nav-sidebar";
import { GlobalRail } from "./global-rail";
import { NotificationBell } from "./notification-bell";
import { PageBreadcrumb, type Crumb } from "./page-breadcrumb";
import { RailQuickActions } from "./rail-quick-actions";
import { useShellSidebars } from "./use-shell-sidebars";
import { getWorkspacePageDescription } from "./workspace-page-descriptions";

export function WorkspaceShell({
  title,
  description,
  crumbs,
  children,
  topExtra,
  sidebarExtra,
  projectType,
  profile: profileProp,
}: {
  title: string;
  /** Override auto blurb from the workspace rail path; pass null to hide. */
  description?: string | null;
  crumbs?: Crumb[];
  children: React.ReactNode;
  topExtra?: React.ReactNode;
  sidebarExtra?: React.ReactNode;
  projectType?: string;
  profile?: Profile | null;
}) {
  const pathname = usePathname();
  const { profile: ctxProfile, unreadCount } = useUser();
  const profile = profileProp ?? ctxProfile;
  const role = profile?.role as UserRole | undefined;
  const roleColors = role ? ROLE_COLORS[role] : ROLE_COLORS.viewer;
  const catalogPerms = useEffectiveBoardPermissions("catalog");
  const {
    workspaceCollapsed,
    libraryCollapsed,
    toggleWorkspace,
    toggleLibrary,
  } = useShellSidebars();
  const resolvedDescription =
    description === undefined
      ? getWorkspacePageDescription(pathname, role)
      : description;

  return (
    <div
      className="app"
      data-board-id="workspace"
      data-rail-collapsed={workspaceCollapsed ? "true" : "false"}
      data-sidebar-collapsed={libraryCollapsed ? "true" : "false"}
    >
      <GlobalRail
        profile={profile}
        unreadCount={unreadCount}
        collapsed={workspaceCollapsed}
        onToggleCollapse={toggleWorkspace}
      >
        <RailQuickActions canCreate={catalogPerms.can_create} />
      </GlobalRail>

      <AppNavSidebar
        profile={profile}
        unreadCount={unreadCount}
        projectType={projectType}
        sidebarExtra={sidebarExtra}
        collapsed={libraryCollapsed}
        onToggleCollapse={toggleLibrary}
      />

      <div className="main">
        <header className="topbar">
          <div className="page-heading">
            {crumbs && crumbs.length > 0 ? <PageBreadcrumb items={crumbs} /> : null}
            <h1 className="page-title">{title}</h1>
            {resolvedDescription ? (
              <p className="page-description">{resolvedDescription}</p>
            ) : null}
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
            ) : null}
            {topExtra}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

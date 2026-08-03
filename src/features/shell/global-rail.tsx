"use client";

import Link from "next/link";
import type { Profile } from "@/features/users/types";
import { WorkspaceRail } from "./workspace-rail";

/** Dark workspace sidebar (icons + labels when expanded). */
export function GlobalRail({
  profile,
  unreadCount = 0,
  collapsed,
  onToggleCollapse,
  children,
}: {
  profile?: Profile | null;
  unreadCount?: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Quick actions (Search / Create) rendered under the logo. */
  children?: React.ReactNode;
}) {
  return (
    <aside
      className={`rail${collapsed ? " is-collapsed" : ""}`}
      aria-label="Workspace"
    >
      <div className="rail-top">
        <Link className="rail-logo" href="/boards/catalog" title="OAS">
          O
        </Link>
        <button
          type="button"
          className="rail-collapse-btn"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand workspace sidebar" : "Collapse workspace sidebar"}
          title={collapsed ? "Expand workspace" : "Collapse workspace"}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      {children}

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
  );
}

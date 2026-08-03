"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Profile, UserRole } from "@/features/users/types";
import { ROLE_LABELS, ROLE_COLORS } from "@/features/users/types";
import {
  UserPinCard,
  type UserMetrics,
} from "@/features/users/components/user-pin-card";
import { MetricsPeriodPicker } from "@/features/users/components/metrics-period-picker";
import {
  buildPeriodMetricsByUser,
  currentMetricsPeriod,
  formatPeriodTitle,
  type ClientMetricEvent,
  type MetricsPeriod,
} from "@/features/users/lib/metrics-period";
import { WorkspaceShell } from "@/features/shell";

type TeamView = "list" | "pins";

function buildTree(users: Profile[]): Map<string | null, Profile[]> {
  const map = new Map<string | null, Profile[]>();
  for (const u of users) {
    const key = u.manager_id ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(u);
  }
  return map;
}

function OrgNode({
  user,
  tree,
  depth = 0,
}: {
  user: Profile;
  tree: Map<string | null, Profile[]>;
  depth?: number;
}) {
  const children = tree.get(user.id) ?? [];
  const rc = ROLE_COLORS[user.role as UserRole] ?? ROLE_COLORS.viewer;

  return (
    <div className="org-node" style={{ marginLeft: depth * 24 }}>
      <Link href={`/users/${user.id}`} className="org-node-card">
        <span
          className="org-node-avatar"
          style={{ background: rc.bg, color: rc.text, border: `1px solid ${rc.border}` }}
        >
          {(user.full_name || user.email)[0].toUpperCase()}
        </span>
        <span className="org-node-info">
          <span className="org-node-name">{user.full_name || user.email.split("@")[0]}</span>
          <span className="org-node-email">{user.email}</span>
        </span>
        <span
          className="org-node-role"
          style={{ background: rc.bg, color: rc.text, border: `1px solid ${rc.border}` }}
        >
          {ROLE_LABELS[user.role as UserRole]}
        </span>
        {children.length > 0 && (
          <span className="org-node-count">
            {children.length} report{children.length > 1 ? "s" : ""}
          </span>
        )}
      </Link>
      {children.length > 0 && (
        <div className="org-children">
          {children.map((c) => (
            <OrgNode key={c.id} user={c} tree={tree} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

const EMPTY_METRICS: UserMetrics = {
  visibleProjects: 0,
  approved: 0,
  pending: 0,
  rejected: 0,
};

export function UsersPage({
  myProfile,
  allUsers,
  clientEvents = [],
}: {
  myProfile: Profile;
  allUsers: Profile[];
  clientEvents?: ClientMetricEvent[];
}) {
  const role = myProfile.role as UserRole;
  const [view, setView] = useState<TeamView>("list");
  const [period, setPeriod] = useState<MetricsPeriod>(() => currentMetricsPeriod());

  const tree = useMemo(() => buildTree(allUsers), [allUsers]);
  const knownIds = useMemo(() => new Set(allUsers.map((u) => u.id)), [allUsers]);
  const roots = useMemo(
    () => allUsers.filter((u) => !u.manager_id || !knownIds.has(u.manager_id)),
    [allUsers, knownIds]
  );
  const reportCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of allUsers) {
      if (!u.manager_id) continue;
      counts[u.manager_id] = (counts[u.manager_id] ?? 0) + 1;
    }
    return counts;
  }, [allUsers]);

  const metricsByUserId = useMemo(
    () =>
      buildPeriodMetricsByUser(
        allUsers.map((u) => u.id),
        clientEvents,
        period
      ),
    [allUsers, clientEvents, period]
  );

  return (
    <WorkspaceShell
      title="Team"
      crumbs={[
        { label: "Boards", href: "/boards/catalog" },
        { label: "Team" },
      ]}
      projectType="Team"
      profile={myProfile}
      topExtra={
        <>
          <div className="view-toggle" role="group" aria-label="Team view">
            <button
              type="button"
              className={`view-toggle-btn${view === "list" ? " active" : ""}`}
              onClick={() => setView("list")}
            >
              List
            </button>
            <button
              type="button"
              className={`view-toggle-btn${view === "pins" ? " active" : ""}`}
              onClick={() => setView("pins")}
            >
              Pins
            </button>
          </div>
          {view === "pins" && (
            <MetricsPeriodPicker value={period} onChange={setPeriod} />
          )}
          <span className="user-chip">
            {allUsers.length} member{allUsers.length !== 1 ? "s" : ""}
          </span>
          {(role === "super_admin" || role === "admin") && (
            <Link href="/admin" className="btn btn-primary">
              + Invite / Manage
            </Link>
          )}
        </>
      }
    >
      <div className="content">
        {view === "pins" ? (
          allUsers.length === 0 ? (
            <div className="empty-state">
              No team members yet. Invite users from the Admin Panel.
            </div>
          ) : (
            <>
              <div className="team-pins-period-hint">
                Metrics for <strong>{formatPeriodTitle(period)}</strong>
              </div>
              <div className="pin-grid">
                {allUsers.map((u) => (
                  <UserPinCard
                    key={u.id}
                    user={u}
                    metrics={metricsByUserId[u.id] ?? EMPTY_METRICS}
                    reportCount={reportCounts[u.id] ?? 0}
                  />
                ))}
              </div>
            </>
          )
        ) : (
          <div className="org-tree">
            {roots.map((r) => (
              <OrgNode key={r.id} user={r} tree={tree} />
            ))}
            {roots.length === 0 && (
              <div className="empty-state">
                No team members yet. Invite users from the Admin Panel.
              </div>
            )}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

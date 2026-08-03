"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Profile, UserRole } from "@/features/users/types";
import { ROLE_LABELS, ROLE_COLORS } from "@/features/users/types";
import type { CrmClient, CrmClientWithProfiles } from "@/features/clients/types";
import { STATUS_COLORS, STATUS_LABELS } from "@/features/clients/types";
import { assignClient } from "@/features/clients/actions";
import { AssignClientModal } from "@/features/clients/components/assign-client-modal";
import { WorkspaceShell } from "@/features/shell";
import { formatDate } from "@/lib/format-date";
import {
  UserBoardAccessTable,
  type UserBoardPerm,
} from "@/features/users/components/user-board-access-table";

type Tab = "info" | "clients" | "team" | "access";

export function UserDetailPage({
  myProfile,
  targetProfile,
  reports,
  clients,
  unassignedClients = [],
  userBoardPerms,
}: {
  myProfile: Profile;
  targetProfile: Profile;
  reports: Profile[];
  clients: CrmClientWithProfiles[];
  unassignedClients?: CrmClient[];
  userBoardPerms?: UserBoardPerm[];
}) {
  const role = myProfile.role as UserRole;
  const rc = ROLE_COLORS[targetProfile.role as UserRole] ?? ROLE_COLORS.viewer;
  const isSA = role === "super_admin";
  const canAssign =
    role === "super_admin" || role === "admin" || role === "team_leader";
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("info");
  const [showAssign, setShowAssign] = useState(false);
  const [pending, startTransition] = useTransition();

  const tabs: Tab[] = isSA
    ? ["info", "clients", "team", "access"]
    : ["info", "clients", "team"];

  function handleAssignClient(clientId: string, note?: string) {
    startTransition(async () => {
      await assignClient(clientId, targetProfile.id, note);
      setShowAssign(false);
      router.refresh();
    });
  }

  const displayName =
    targetProfile.full_name || targetProfile.email.split("@")[0];

  return (
    <WorkspaceShell
      title={displayName}
      crumbs={[
        { label: "Team", href: "/users" },
        { label: displayName },
      ]}
      projectType="Team"
      profile={myProfile}
      topExtra={
        (role === "super_admin" || role === "admin") && (
          <Link href="/admin" className="btn">
            Manage in Admin
          </Link>
        )
      }
    >
      <div className="content">
        <AssignClientModal
          open={showAssign}
          clients={unassignedClients}
          pending={pending}
          onClose={() => setShowAssign(false)}
          onAssign={handleAssignClient}
        />

        <div className="user-detail-header">
          <span
            className="user-detail-avatar"
            style={{
              background: rc.bg,
              color: rc.text,
              border: `2px solid ${rc.border}`,
            }}
          >
            {(targetProfile.full_name || targetProfile.email)[0].toUpperCase()}
          </span>
          <div className="user-detail-meta">
            <div className="user-detail-name">
              {targetProfile.full_name || targetProfile.email.split("@")[0]}
            </div>
            <div className="user-detail-email">{targetProfile.email}</div>
            <span
              className="user-detail-role-badge"
              style={{
                background: rc.bg,
                color: rc.text,
                border: `1px solid ${rc.border}`,
              }}
            >
              {ROLE_LABELS[targetProfile.role as UserRole]}
            </span>
          </div>
          <div className="user-detail-stats">
            <div className="user-stat">
              <span className="user-stat-num">{clients.length}</span>
              <span className="user-stat-label">Clients</span>
            </div>
            <div className="user-stat">
              <span className="user-stat-num">{reports.length}</span>
              <span className="user-stat-label">Reports</span>
            </div>
          </div>
        </div>

        <div className="detail-tabs">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              className={`detail-tab${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "info"
                ? "Info"
                : t === "clients"
                  ? `Clients (${clients.length})`
                  : t === "team"
                    ? `Team (${reports.length})`
                    : "Access Boards"}
            </button>
          ))}
        </div>

        {tab === "info" && (
          <div className="detail-tab-content">
            <div className="info-section-title">Basic Information</div>
            <div className="admin-info-grid">
              <div className="admin-info-row">
                <span className="admin-info-label">Full name</span>
                <span>{targetProfile.full_name ?? "—"}</span>
              </div>
              <div className="admin-info-row">
                <span className="admin-info-label">Email</span>
                <span>{targetProfile.email}</span>
              </div>
              <div className="admin-info-row">
                <span className="admin-info-label">Phone</span>
                <span>{targetProfile.phone ?? "—"}</span>
              </div>
              <div className="admin-info-row">
                <span className="admin-info-label">Department</span>
                <span>{targetProfile.department ?? "—"}</span>
              </div>
              <div className="admin-info-row">
                <span className="admin-info-label">Member since</span>
                <span>{formatDate(targetProfile.created_at)}</span>
              </div>
            </div>
          </div>
        )}

        {tab === "clients" && (
          <div className="detail-tab-content">
            {canAssign && (
              <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowAssign(true)}
                >
                  Assign client
                </button>
              </div>
            )}
            {clients.length === 0 ? (
              <div className="empty-state">No clients assigned.</div>
            ) : (
              <div className="admin-client-list">
                {clients.map((c) => {
                  const sc = STATUS_COLORS[c.status];
                  return (
                    <Link key={c.id} href={`/clients/${c.id}`} className="admin-client-row">
                      <span className="admin-client-name">{c.name}</span>
                      <span className="admin-client-industry">{c.industry ?? "—"}</span>
                      <span
                        className="list-status"
                        style={{
                          background: sc.bg,
                          color: sc.text,
                          borderColor: sc.border,
                        }}
                      >
                        {STATUS_LABELS[c.status]}
                      </span>
                      <span className="admin-client-date">
                        {formatDate(c.created_at)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "team" && (
          <div className="detail-tab-content">
            {reports.length === 0 ? (
              <div className="empty-state">No direct reports.</div>
            ) : (
              <div className="admin-client-list">
                {reports.map((r) => {
                  const rrc = ROLE_COLORS[r.role as UserRole] ?? ROLE_COLORS.viewer;
                  return (
                    <Link key={r.id} href={`/users/${r.id}`} className="admin-client-row">
                      <span
                        className="admin-user-avatar"
                        style={{
                          background: rrc.bg,
                          color: rrc.text,
                          border: `1px solid ${rrc.border}`,
                        }}
                      >
                        {(r.full_name || r.email)[0].toUpperCase()}
                      </span>
                      <span className="admin-client-name">
                        {r.full_name || r.email.split("@")[0]}
                      </span>
                      <span className="admin-client-industry">{r.email}</span>
                      <span
                        style={{
                          background: rrc.bg,
                          color: rrc.text,
                          border: `1px solid ${rrc.border}`,
                          padding: "2px 8px",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {ROLE_LABELS[r.role as UserRole]}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "access" && isSA && userBoardPerms && (
          <div className="detail-tab-content">
            <UserBoardAccessTable
              userId={targetProfile.id}
              initialPerms={userBoardPerms}
            />
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Profile, UserRole } from "@/features/users/types";
import { ROLE_LABELS, ROLE_COLORS } from "@/features/users/types";
import type { CrmClientWithProfiles, ClientAssignment, ClientStatus } from "@/features/clients/types";
import { STATUS_COLORS, STATUS_LABELS } from "@/features/clients/types";
import {
  assignClient,
  updateClientStatus,
  updateClientNotes,
  type AssignClientFields,
} from "@/features/clients/actions";
import { AssignMemberModal } from "@/features/clients/components/assign-member-modal";
import { createProject } from "@/features/projects/actions";
import {
  CreateProjectModal,
  type CreateProjectPayload,
} from "@/features/projects/components/create-project-modal";
import {
  type ProjectWithRelations,
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_LABELS,
  projectCalendarEnd,
  projectCalendarStart,
} from "@/features/projects/types";
import { WorkspaceShell } from "@/features/shell";
import { formatDate, formatDateTime } from "@/lib/format-date";

type Tab = "overview" | "projects" | "history" | "notes";

export function ClientDetailPage({
  myProfile,
  client,
  assignments,
  allUsers,
  projects = [],
  initialTab = "overview",
}: {
  myProfile: Profile;
  client: CrmClientWithProfiles;
  assignments: ClientAssignment[];
  allUsers: Profile[];
  projects?: ProjectWithRelations[];
  initialTab?: Tab;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [showAssign, setShowAssign] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [notes, setNotes] = useState(client.notes ?? "");
  const [notesEditing, setNotesEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const role = myProfile.role as UserRole;
  const canAssign = role === "super_admin" || role === "admin" || role === "team_leader";
  const canEdit = role !== "viewer";
  const canCreateProject =
    role === "super_admin" ||
    role === "admin" ||
    role === "team_leader" ||
    role === "sales";
  const sc = STATUS_COLORS[client.status];

  // Non-viewers for role-specific assign slots (sales / TL / admin filtered in the modal).
  const assignablePeople = useMemo(
    () => allUsers.filter((u) => u.role !== "viewer"),
    [allUsers]
  );

  function handleAssign(fields: AssignClientFields) {
    startTransition(async () => {
      await assignClient(client.id, fields);
      setShowAssign(false);
      router.refresh();
    });
  }

  function handleStatusChange(status: ClientStatus) {
    startTransition(async () => {
      await updateClientStatus(client.id, status);
      router.refresh();
    });
  }

  function handleSaveNotes() {
    startTransition(async () => {
      await updateClientNotes(client.id, notes);
      setNotesEditing(false);
      router.refresh();
    });
  }

  function handleCreateProject(payload: CreateProjectPayload) {
    startTransition(async () => {
      await createProject({
        name: payload.name,
        clientId: payload.clientId,
        status: payload.status,
        startDate: payload.startDate,
        endDate: payload.endDate,
        notes: payload.notes,
        memberIds: payload.members,
      });
      setShowCreateProject(false);
      router.refresh();
    });
  }

  return (
    <WorkspaceShell
      title={client.name}
      crumbs={[
        { label: "Clients", href: "/clients" },
        { label: client.name },
      ]}
      projectType="Clients"
      profile={myProfile}
      topExtra={
        <>
          <span
            className="list-status"
            style={{ background: sc.bg, color: sc.text, borderColor: sc.border }}
          >
            {STATUS_LABELS[client.status]}
          </span>
          {canAssign && (
            <button className="btn btn-primary" onClick={() => setShowAssign(true)}>
              Assign
            </button>
          )}
          {canEdit && (
            <select
              className="btn"
              value={client.status}
              disabled={pending}
              onChange={(e) => handleStatusChange(e.target.value as ClientStatus)}
              style={{ cursor: "pointer" }}
            >
              <option value="unassigned">Unassigned</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="closed">Closed</option>
            </select>
          )}
        </>
      }
    >
      <div className="content">
        <AssignMemberModal
          open={showAssign}
          users={assignablePeople}
          pending={pending}
          current={{
            assignedTo: client.assigned_to,
            teamLeaderId: client.team_leader_id,
            adminId: client.admin_id,
          }}
          onClose={() => setShowAssign(false)}
          onAssign={handleAssign}
        />
        <CreateProjectModal
          open={showCreateProject}
          clients={[client]}
          users={allUsers}
          actorRole={role}
          defaultClientId={client.id}
          pending={pending}
          onClose={() => setShowCreateProject(false)}
          onCreate={handleCreateProject}
        />

        <div className="detail-tabs">
          {(["overview", "projects", "history", "notes"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`detail-tab${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "overview"
                ? "Overview"
                : t === "projects"
                  ? `Projects (${projects.length})`
                  : t === "history"
                    ? `History (${assignments.length})`
                    : "Notes"}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="detail-tab-content">
            <div className="admin-info-grid">
              <div className="admin-info-row">
                <span className="admin-info-label">Name</span>
                <span style={{ fontWeight: 600 }}>{client.name}</span>
              </div>
              <div className="admin-info-row">
                <span className="admin-info-label">Industry</span>
                <span>{client.industry ?? "—"}</span>
              </div>
              <div className="admin-info-row">
                <span className="admin-info-label">Status</span>
                <span
                  className="list-status"
                  style={{
                    background: sc.bg,
                    color: sc.text,
                    borderColor: sc.border,
                  }}
                >
                  {STATUS_LABELS[client.status]}
                </span>
              </div>
              <div className="admin-info-row">
                <span className="admin-info-label">Assigned to</span>
                <span>
                  {client.assignee ? (
                    <Link
                      href={`/users/${client.assignee.id}`}
                      style={{ color: "var(--jira-blue)" }}
                    >
                      {client.assignee.full_name ||
                        client.assignee.email.split("@")[0]}{" "}
                      · {ROLE_LABELS[client.assignee.role as UserRole]}
                    </Link>
                  ) : (
                    <em style={{ color: "var(--jira-muted)" }}>Unassigned</em>
                  )}
                </span>
              </div>
              <div className="admin-info-row">
                <span className="admin-info-label">Team Leader</span>
                <span>
                  {client.team_leader ? (
                    <Link
                      href={`/users/${client.team_leader.id}`}
                      style={{ color: "var(--jira-blue)" }}
                    >
                      {client.team_leader.full_name ||
                        client.team_leader.email.split("@")[0]}
                    </Link>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
              <div className="admin-info-row">
                <span className="admin-info-label">Admin</span>
                <span>
                  {client.admin ? (
                    <Link
                      href={`/users/${client.admin.id}`}
                      style={{ color: "var(--jira-blue)" }}
                    >
                      {client.admin.full_name || client.admin.email.split("@")[0]}
                    </Link>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
              <div className="admin-info-row">
                <span className="admin-info-label">Created by</span>
                <span>
                  {client.creator ? (
                    <Link
                      href={`/users/${client.creator.id}`}
                      style={{ color: "var(--jira-blue)" }}
                    >
                      {client.creator.full_name ||
                        client.creator.email.split("@")[0]}
                    </Link>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
              <div className="admin-info-row">
                <span className="admin-info-label">Created</span>
                <span>{formatDateTime(client.created_at)}</span>
              </div>
            </div>
          </div>
        )}

        {tab === "projects" && (
          <div className="detail-tab-content">
            {canCreateProject && (
              <div className="client-projects-toolbar">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowCreateProject(true)}
                >
                  + New Project
                </button>
              </div>
            )}
            {projects.length === 0 ? (
              <div className="empty-state">
                No projects for this client yet.
              </div>
            ) : (
              <div className="project-list">
                {[...projects]
                  .sort(
                    (a, b) =>
                      new Date(b.created_at).getTime() -
                      new Date(a.created_at).getTime()
                  )
                  .map((p) => {
                    const psc = PROJECT_STATUS_COLORS[p.status];
                    const start = projectCalendarStart(p);
                    const end = projectCalendarEnd(p);
                    const members = p.members ?? [];
                    return (
                      <Link
                        key={p.id}
                        href={`/projects/${p.id}`}
                        className="project-list-row project-list-row-link"
                      >
                        <div className="project-list-main">
                          <span className="project-list-name">{p.name}</span>
                          <span
                            className="list-status"
                            style={{
                              background: psc.bg,
                              color: psc.text,
                              borderColor: psc.border,
                            }}
                          >
                            {PROJECT_STATUS_LABELS[p.status]}
                          </span>
                        </div>
                        <div className="project-list-meta">
                          <span className="project-list-dates">
                            {start === end ? start : `${start} → ${end}`}
                          </span>
                          <span className="project-list-client muted">
                            {members.length} member
                            {members.length !== 1 ? "s" : ""}
                            {members.length > 0 &&
                              ` · ${members
                                .slice(0, 3)
                                .map(
                                  (m) =>
                                    m.user?.full_name ||
                                    m.user?.email?.split("@")[0] ||
                                    "?"
                                )
                                .join(", ")}${members.length > 3 ? "…" : ""}`}
                          </span>
                          <span className="project-list-dates">
                            Created {formatDate(p.created_at)}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="detail-tab-content">
            <div className="timeline">
              <div className="timeline-item">
                <div className="timeline-dot timeline-dot-create">+</div>
                <div className="timeline-body">
                  <div className="timeline-title">Client created</div>
                  <div className="timeline-meta">
                    by {client.creator?.full_name || client.creator?.email || "Unknown"}
                    {" · "}
                    {formatDateTime(client.created_at)}
                  </div>
                </div>
              </div>
              {assignments.map((a) => {
                const arc = a.assignee
                  ? ROLE_COLORS[a.assignee.role as UserRole]
                  : ROLE_COLORS.viewer;
                return (
                  <div key={a.id} className="timeline-item">
                    <div className="timeline-dot timeline-dot-assign">→</div>
                    <div className="timeline-body">
                      <div className="timeline-title">
                        Assigned to{" "}
                        <span style={{ fontWeight: 700 }}>
                          {a.assignee?.full_name ||
                            a.assignee?.email?.split("@")[0] ||
                            "Unknown"}
                        </span>
                        {a.assignee && (
                          <span
                            style={{
                              marginLeft: 6,
                              background: arc.bg,
                              color: arc.text,
                              border: `1px solid ${arc.border}`,
                              padding: "1px 6px",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {ROLE_LABELS[a.assignee.role as UserRole]}
                          </span>
                        )}
                      </div>
                      <div className="timeline-meta">
                        by {a.assigner?.full_name || a.assigner?.email || "Unknown"}
                        {" · "}
                        {formatDateTime(a.created_at)}
                      </div>
                      {a.note && <div className="timeline-note">&quot;{a.note}&quot;</div>}
                    </div>
                  </div>
                );
              })}
              {assignments.length === 0 && (
                <div
                  style={{
                    color: "var(--jira-muted)",
                    fontSize: 13,
                    marginTop: 8,
                  }}
                >
                  No assignments yet.
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "notes" && (
          <div className="detail-tab-content">
            {notesEditing ? (
              <div>
                <textarea
                  className="notes-editor"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={8}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveNotes}
                    disabled={pending}
                  >
                    {pending ? "Saving…" : "Save notes"}
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      setNotes(client.notes ?? "");
                      setNotesEditing(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    fontSize: 14,
                    lineHeight: 1.6,
                    minHeight: 60,
                    color: notes ? "var(--jira-text)" : "var(--jira-muted)",
                  }}
                >
                  {notes || "No notes yet."}
                </div>
                {canEdit && (
                  <button
                    className="btn"
                    style={{ marginTop: 12 }}
                    onClick={() => setNotesEditing(true)}
                  >
                    Edit notes
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

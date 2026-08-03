"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Profile, UserRole } from "@/features/users/types";
import { ROLE_LABELS, ROLE_COLORS } from "@/features/users/types";
import {
  addProjectMember,
  removeProjectMember,
  updateProject,
  updateProjectMemberRole,
  updateProjectStatus,
} from "@/features/projects/actions";
import { AddProjectMemberModal } from "@/features/projects/components/add-project-member-modal";
import type {
  ProjectMemberRole,
  ProjectStatus,
  ProjectWithRelations,
} from "@/features/projects/types";
import {
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_LABELS,
  PROJECT_MEMBER_ROLE_LABELS,
  projectCalendarEnd,
  projectCalendarStart,
} from "@/features/projects/types";
import { WorkspaceShell } from "@/features/shell";
import { formatDateTime } from "@/lib/format-date";
import { ProjectOverviewPins } from "@/features/onboarding/components/project-overview-pins";
import type { ProjectItem } from "@/features/onboarding/types";

type Tab = "overview" | "members" | "notes";

const MEMBER_SECTIONS: ProjectMemberRole[] = ["admin", "team_leader", "sales"];

export function ProjectDetailPage({
  myProfile,
  project,
  allUsers,
  projectItems = [],
}: {
  myProfile: Profile;
  project: ProjectWithRelations;
  allUsers: Profile[];
  projectItems?: ProjectItem[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [showAdd, setShowAdd] = useState(false);
  const [notes, setNotes] = useState(project.notes ?? "");
  const [notesEditing, setNotesEditing] = useState(false);
  const [startDate, setStartDate] = useState(project.start_date ?? "");
  const [endDate, setEndDate] = useState(project.end_date ?? "");
  const [datesEditing, setDatesEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const role = myProfile.role as UserRole;
  const canManage =
    role === "super_admin" || role === "admin" || role === "team_leader";
  const canActivate = role === "super_admin" || role === "admin";
  const canEditDetails =
    canManage ||
    (role === "sales" && project.created_by === myProfile.id);
  const sc = PROJECT_STATUS_COLORS[project.status];
  const members = project.members ?? [];
  const isProjectMember = members.some((m) => m.user_id === myProfile.id);
  const canEditPins = canEditDetails || isProjectMember;
  const memberIds = useMemo(() => members.map((m) => m.user_id), [members]);

  function handleStatusChange(status: ProjectStatus) {
    startTransition(async () => {
      await updateProjectStatus(project.id, status);
      router.refresh();
    });
  }

  function handleAddMember(userId: string, roleOnProject: ProjectMemberRole) {
    startTransition(async () => {
      await addProjectMember(project.id, userId, roleOnProject);
      setShowAdd(false);
      router.refresh();
    });
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      await removeProjectMember(project.id, userId);
      router.refresh();
    });
  }

  function handleRoleChange(userId: string, roleOnProject: ProjectMemberRole) {
    startTransition(async () => {
      await updateProjectMemberRole(project.id, userId, roleOnProject);
      router.refresh();
    });
  }

  function handleSaveNotes() {
    startTransition(async () => {
      await updateProject(project.id, { notes });
      setNotesEditing(false);
      router.refresh();
    });
  }

  function handleSaveDates() {
    startTransition(async () => {
      await updateProject(project.id, {
        startDate: startDate || null,
        endDate: endDate || null,
      });
      setDatesEditing(false);
      router.refresh();
    });
  }

  const calStart = projectCalendarStart(project);
  const calEnd = projectCalendarEnd(project);

  const crumbs = [
    { label: "Projects", href: "/projects" },
    ...(project.client
      ? [
          {
            label: project.client.name,
            href: `/clients/${project.client.id}?tab=projects`,
          },
        ]
      : []),
    { label: project.name },
  ];

  return (
    <WorkspaceShell
      title={project.name}
      crumbs={crumbs}
      projectType="Projects"
      profile={myProfile}
      topExtra={
        <>
          <span
            className="list-status"
            style={{ background: sc.bg, color: sc.text, borderColor: sc.border }}
          >
            {PROJECT_STATUS_LABELS[project.status]}
          </span>
          {canActivate && (
            <select
              className="btn"
              value={project.status}
              disabled={pending}
              onChange={(e) =>
                handleStatusChange(e.target.value as ProjectStatus)
              }
              style={{ cursor: "pointer" }}
            >
              {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {PROJECT_STATUS_LABELS[s]}
                  </option>
                )
              )}
            </select>
          )}
        </>
      }
    >
      <div className="content">
        <AddProjectMemberModal
          open={showAdd}
          users={allUsers}
          excludeUserIds={memberIds}
          pending={pending}
          onClose={() => setShowAdd(false)}
          onAdd={handleAddMember}
        />

        <div className="detail-tabs">
          {(["overview", "members", "notes"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`detail-tab${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "overview"
                ? "Overview"
                : t === "members"
                  ? `Members (${members.length})`
                  : "Notes"}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="detail-tab-content">
            <div className="admin-info-grid">
              <div className="admin-info-row">
                <span className="admin-info-label">Name</span>
                <span style={{ fontWeight: 600 }}>{project.name}</span>
              </div>
              <div className="admin-info-row">
                <span className="admin-info-label">Client</span>
                <span>
                  {project.client ? (
                    <Link
                      href={`/clients/${project.client.id}?tab=projects`}
                      style={{ color: "var(--jira-blue)" }}
                    >
                      {project.client.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </span>
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
                  {PROJECT_STATUS_LABELS[project.status]}
                </span>
              </div>
              <div className="admin-info-row">
                <span className="admin-info-label">Dates</span>
                <span>
                  {datesEditing ? (
                    <span className="project-dates-edit">
                      <input
                        className="search"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                      <span>→</span>
                      <input
                        className="search"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={pending}
                        onClick={handleSaveDates}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setStartDate(project.start_date ?? "");
                          setEndDate(project.end_date ?? "");
                          setDatesEditing(false);
                        }}
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <>
                      {calStart === calEnd ? calStart : `${calStart} → ${calEnd}`}
                      {canEditDetails && (
                        <button
                          type="button"
                          className="btn"
                          style={{ marginLeft: 8 }}
                          onClick={() => setDatesEditing(true)}
                        >
                          Edit
                        </button>
                      )}
                    </>
                  )}
                </span>
              </div>
              <div className="admin-info-row">
                <span className="admin-info-label">Created by</span>
                <span>
                  {project.creator ? (
                    <Link
                      href={`/users/${project.creator.id}`}
                      style={{ color: "var(--jira-blue)" }}
                    >
                      {project.creator.full_name ||
                        project.creator.email.split("@")[0]}
                    </Link>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
              <div className="admin-info-row">
                <span className="admin-info-label">Created</span>
                <span>{formatDateTime(project.created_at)}</span>
              </div>
            </div>

            {canManage && (
              <button
                className="btn btn-primary"
                type="button"
                style={{ marginTop: 12 }}
                onClick={() => setShowAdd(true)}
              >
                + Add member
              </button>
            )}

            <ProjectOverviewPins
              projectId={project.id}
              initialItems={projectItems}
              canEdit={canEditPins}
            />
          </div>
        )}

        {tab === "members" && (
          <div className="detail-tab-content">
            {MEMBER_SECTIONS.map((sectionRole) => {
              const section = members.filter(
                (m) => m.role_on_project === sectionRole
              );
              return (
                <div key={sectionRole} className="project-member-section">
                  <h3 className="project-member-section-title">
                    {PROJECT_MEMBER_ROLE_LABELS[sectionRole]}
                    <span className="project-member-section-count">
                      {section.length}
                    </span>
                  </h3>
                  {section.length === 0 ? (
                    <div className="project-member-empty">No one assigned</div>
                  ) : (
                    <div className="project-member-list">
                      {section.map((m) => {
                        const u = m.user;
                        const displayName =
                          u?.full_name ||
                          u?.email?.split("@")[0] ||
                          "Unknown member";
                        const displayEmail = u?.email ?? m.user_id;
                        const orgRole = (u?.role as UserRole | undefined) ?? null;
                        const rc =
                          (orgRole ? ROLE_COLORS[orgRole] : null) ??
                          ROLE_COLORS.viewer;
                        return (
                          <div key={m.id} className="project-member-row">
                            <span
                              className="project-member-avatar"
                              style={{
                                background: rc.bg,
                                color: rc.text,
                                borderColor: rc.border,
                              }}
                            >
                              {displayName[0].toUpperCase()}
                            </span>
                            <div className="project-member-info">
                              {u ? (
                                <Link
                                  href={`/users/${u.id}`}
                                  className="project-member-name"
                                >
                                  {displayName}
                                </Link>
                              ) : (
                                <span className="project-member-name">
                                  {displayName}
                                </span>
                              )}
                              <span className="project-member-email">
                                {displayEmail}
                                {orgRole ? ` · ${ROLE_LABELS[orgRole]}` : ""}
                              </span>
                            </div>
                            {canManage && (
                              <div className="project-member-actions">
                                <select
                                  className="search"
                                  value={m.role_on_project}
                                  disabled={pending}
                                  onChange={(e) =>
                                    handleRoleChange(
                                      m.user_id,
                                      e.target.value as ProjectMemberRole
                                    )
                                  }
                                >
                                  {(
                                    Object.keys(
                                      PROJECT_MEMBER_ROLE_LABELS
                                    ) as ProjectMemberRole[]
                                  ).map((r) => (
                                    <option key={r} value={r}>
                                      {PROJECT_MEMBER_ROLE_LABELS[r]}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="btn"
                                  disabled={pending}
                                  onClick={() => handleRemove(m.user_id)}
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
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
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={pending}
                  >
                    {pending ? "Saving…" : "Save notes"}
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      setNotes(project.notes ?? "");
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
                {canEditDetails && (
                  <button
                    className="btn"
                    type="button"
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

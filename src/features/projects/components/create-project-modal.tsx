"use client";

import { useEffect, useMemo, useState } from "react";
import type { Profile, UserRole } from "@/features/users/types";
import { ROLE_LABELS, ROLE_COLORS } from "@/features/users/types";
import type { CrmClient } from "@/features/clients/types";
import type { ProjectMemberRole, ProjectStatus } from "../types";
import { PROJECT_STATUS_LABELS } from "../types";
import { SearchAutocomplete } from "@/shared/ui";

export type CreateProjectPayload = {
  name: string;
  clientId: string;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  members: { userId: string; roleOnProject: ProjectMemberRole }[];
};

type Props = {
  open: boolean;
  clients: CrmClient[];
  users: Profile[];
  actorRole: UserRole;
  /** When set, client is pre-filled and the picker is hidden. */
  defaultClientId?: string;
  pending?: boolean;
  onClose: () => void;
  onCreate: (payload: CreateProjectPayload) => void;
};

function defaultRoleForUser(role: UserRole): ProjectMemberRole | null {
  if (role === "admin") return "admin";
  if (role === "team_leader") return "team_leader";
  if (role === "sales") return "sales";
  return null;
}

export function CreateProjectModal({
  open,
  clients,
  users,
  actorRole,
  defaultClientId,
  pending = false,
  onClose,
  onCreate,
}: Props) {
  const forceUnassigned =
    actorRole === "sales" || actorRole === "team_leader";
  const lockedClient = defaultClientId
    ? clients.find((c) => c.id === defaultClientId) ?? null
    : null;
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [status, setStatus] = useState<ProjectStatus>(
    forceUnassigned ? "unassigned" : "active"
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [selected, setSelected] = useState<
    Record<string, ProjectMemberRole>
  >({});

  useEffect(() => {
    if (!open) return;
    void Promise.resolve().then(() => {
      setName("");
      setClientId(defaultClientId ?? "");
      setStatus(forceUnassigned ? "unassigned" : "active");
      setStartDate("");
      setEndDate("");
      setNotes("");
      setClientQuery("");
      setMemberQuery("");
      setSelected({});
    });
  }, [open, forceUnassigned, defaultClientId]);

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.industry?.toLowerCase().includes(q) ?? false)
    );
  }, [clients, clientQuery]);

  const staffUsers = useMemo(
    () =>
      users.filter((u) => {
        const r = u.role as UserRole;
        // Super admins are not assignable as project team members
        return r === "admin" || r === "team_leader" || r === "sales";
      }),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return staffUsers;
    return staffUsers.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name?.toLowerCase().includes(q) ?? false)
    );
  }, [staffUsers, memberQuery]);

  if (!open) return null;

  function toggleMember(u: Profile) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[u.id]) {
        delete next[u.id];
      } else {
        const role = defaultRoleForUser(u.role as UserRole);
        if (role) next[u.id] = role;
      }
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !clientId) return;
    onCreate({
      name: name.trim(),
      clientId,
      status: forceUnassigned ? "unassigned" : status,
      startDate: startDate || null,
      endDate: endDate || null,
      notes: notes.trim() || null,
      members: Object.entries(selected).map(([userId, roleOnProject]) => ({
        userId,
        roleOnProject,
      })),
    });
  }

  return (
    <div className="picker-backdrop open" role="presentation" onClick={onClose}>
      <div
        className="picker-modal project-create-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="createProjectTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="picker-head">
          <h2 id="createProjectTitle">New Project</h2>
          <button
            type="button"
            className="btn btn-ghost picker-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={submit} className="project-create-form">
          <label className="project-field">
            <span>Project name *</span>
            <input
              className="search"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Q3 rollout"
            />
          </label>

          <div className="project-field">
            <span>Client *</span>
            {lockedClient ? (
              <div className="project-status-locked">{lockedClient.name}</div>
            ) : (
              <>
                <SearchAutocomplete
                  wrapClassName="search-wrap picker-search"
                  value={clientQuery}
                  onChange={setClientQuery}
                  suggestions={clients.map((c) => ({
                    id: c.id,
                    label: c.name,
                    meta: c.industry || undefined,
                  }))}
                  placeholder="Search clients…"
                  recentKey="ac:create-project-client"
                />
                <div className="picker-list project-create-client-list">
                  {filteredClients.length === 0 ? (
                    <div className="picker-empty">No clients found.</div>
                  ) : (
                    filteredClients.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`picker-item${clientId === c.id ? " active" : ""}`}
                        onClick={() => setClientId(c.id)}
                      >
                        <span className="picker-item-name">{c.name}</span>
                        {clientId === c.id && (
                          <span style={{ color: "var(--jira-blue)" }}>✓</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div className="project-create-row">
            {forceUnassigned ? (
              <div className="project-field project-field-status">
                <span>Status</span>
                <div className="project-status-locked">
                  Unassigned — an admin will activate this project
                </div>
              </div>
            ) : (
              <label className="project-field project-field-status">
                <span>Status</span>
                <select
                  className="search"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                >
                  {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map(
                    (s) => (
                      <option key={s} value={s}>
                        {PROJECT_STATUS_LABELS[s]}
                      </option>
                    )
                  )}
                </select>
              </label>
            )}
            <label className="project-field">
              <span>Start date</span>
              <input
                className="search"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="project-field">
              <span>End date</span>
              <input
                className="search"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </div>

          <label className="project-field">
            <span>Notes</span>
            <textarea
              className="notes-editor"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes…"
            />
          </label>

          <div className="project-field">
            <span>Team members</span>
            <SearchAutocomplete
              wrapClassName="search-wrap picker-search"
              value={memberQuery}
              onChange={setMemberQuery}
              suggestions={staffUsers.map((u) => ({
                id: u.id,
                label: u.full_name || u.email.split("@")[0],
                meta: u.email,
              }))}
              placeholder="Search staff…"
              recentKey="ac:create-project-staff"
            />
            <div className="picker-list project-create-member-list">
              {filteredUsers.length === 0 ? (
                <div className="picker-empty">No matching staff.</div>
              ) : (
                filteredUsers.map((u) => {
                  const rc = ROLE_COLORS[u.role as UserRole] ?? ROLE_COLORS.viewer;
                  const isOn = Boolean(selected[u.id]);
                  return (
                    <div
                      key={u.id}
                      className={`project-member-pick-row${isOn ? " active" : ""}`}
                    >
                      <button
                        type="button"
                        className="project-member-pick-btn"
                        onClick={() => toggleMember(u)}
                      >
                        <span
                          className="project-member-avatar"
                          style={{
                            background: rc.bg,
                            color: rc.text,
                            borderColor: rc.border,
                            width: 28,
                            height: 28,
                            fontSize: 12,
                          }}
                        >
                          {(u.full_name || u.email)[0].toUpperCase()}
                        </span>
                        <span className="project-member-pick-meta">
                          <span className="project-member-pick-name">
                            {u.full_name || u.email.split("@")[0]}
                          </span>
                          <span className="project-member-pick-role">
                            {ROLE_LABELS[u.role as UserRole]}
                          </span>
                        </span>
                        {isOn && (
                          <span className="project-member-pick-check" aria-hidden>
                            ✓
                          </span>
                        )}
                      </button>
                      {isOn && (
                        <label className="project-member-role-field">
                          <span>Role on project</span>
                          <select
                            className="project-member-role-select"
                            value={selected[u.id]}
                            onChange={(e) =>
                              setSelected((prev) => ({
                                ...prev,
                                [u.id]: e.target.value as ProjectMemberRole,
                              }))
                            }
                          >
                            <option value="admin">Admin</option>
                            <option value="team_leader">Team Leader</option>
                            <option value="sales">Sales</option>
                          </select>
                        </label>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="assign-modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!name.trim() || !clientId || pending}
            >
              {pending ? "Creating…" : "Create project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

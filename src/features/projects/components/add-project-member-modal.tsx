"use client";

import { useEffect, useMemo, useState } from "react";
import type { Profile, UserRole } from "@/features/users/types";
import { ROLE_LABELS, ROLE_COLORS } from "@/features/users/types";
import type { ProjectMemberRole } from "../types";
import { PROJECT_MEMBER_ROLE_LABELS } from "../types";
import { SearchAutocomplete } from "@/shared/ui";

type Props = {
  open: boolean;
  users: Profile[];
  excludeUserIds?: string[];
  pending?: boolean;
  onClose: () => void;
  onAdd: (userId: string, roleOnProject: ProjectMemberRole) => void;
};

function defaultRoleForUser(role: UserRole): ProjectMemberRole {
  if (role === "admin") return "admin";
  if (role === "team_leader") return "team_leader";
  return "sales";
}

export function AddProjectMemberModal({
  open,
  users,
  excludeUserIds = [],
  pending = false,
  onClose,
  onAdd,
}: Props) {
  const [query, setQuery] = useState("");
  const [userId, setUserId] = useState("");
  const [roleOnProject, setRoleOnProject] = useState<ProjectMemberRole>("sales");

  const exclude = useMemo(() => new Set(excludeUserIds), [excludeUserIds]);

  useEffect(() => {
    if (!open) return;
    void Promise.resolve().then(() => {
      setQuery("");
      setUserId("");
      setRoleOnProject("sales");
    });
  }, [open]);

  const staffPool = useMemo(
    () =>
      users.filter(
        (u) =>
          !exclude.has(u.id) &&
          (u.role === "admin" || u.role === "team_leader" || u.role === "sales")
      ),
    [users, exclude]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staffPool;
    return staffPool.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name?.toLowerCase().includes(q) ?? false)
    );
  }, [staffPool, query]);

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    onAdd(userId, roleOnProject);
  }

  return (
    <div className="picker-backdrop open" role="presentation" onClick={onClose}>
      <div
        className="picker-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="addProjectMemberTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="picker-head">
          <h2 id="addProjectMemberTitle">Add member</h2>
          <button
            type="button"
            className="btn btn-ghost picker-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <SearchAutocomplete
          wrapClassName="search-wrap picker-search"
          value={query}
          onChange={setQuery}
          suggestions={staffPool.map((u) => ({
            id: u.id,
            label: u.full_name || u.email.split("@")[0],
            meta: u.email,
          }))}
          placeholder="Search users…"
          autoFocus
          recentKey="ac:project-member"
        />

        <div className="picker-list">
          {filtered.length === 0 ? (
            <div className="picker-empty">No matching users.</div>
          ) : (
            filtered.map((u) => {
              const rc = ROLE_COLORS[u.role as UserRole] ?? ROLE_COLORS.viewer;
              const selected = userId === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  className={`picker-item${selected ? " active" : ""}`}
                  onClick={() => {
                    setUserId(u.id);
                    setRoleOnProject(defaultRoleForUser(u.role as UserRole));
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 12,
                      background: rc.bg,
                      color: rc.text,
                      border: `1px solid ${rc.border}`,
                      flexShrink: 0,
                    }}
                  >
                    {(u.full_name || u.email)[0].toUpperCase()}
                  </span>
                  <span className="picker-item-name">
                    {u.full_name || u.email.split("@")[0]}
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 11,
                        color: "var(--jira-muted)",
                      }}
                    >
                      {ROLE_LABELS[u.role as UserRole]}
                    </span>
                  </span>
                  {selected && <span style={{ color: "var(--jira-blue)" }}>✓</span>}
                </button>
              );
            })
          )}
        </div>

        <form onSubmit={submit} className="assign-modal-footer">
          <label className="assign-modal-note-label">
            Role on project
            <select
              className="search"
              value={roleOnProject}
              onChange={(e) =>
                setRoleOnProject(e.target.value as ProjectMemberRole)
              }
            >
              {(Object.keys(PROJECT_MEMBER_ROLE_LABELS) as ProjectMemberRole[]).map(
                (r) => (
                  <option key={r} value={r}>
                    {PROJECT_MEMBER_ROLE_LABELS[r]}
                  </option>
                )
              )}
            </select>
          </label>
          <div className="assign-modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!userId || pending}
            >
              {pending ? "Adding…" : "Add member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

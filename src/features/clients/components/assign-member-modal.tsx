"use client";

import { useEffect, useMemo, useState } from "react";
import type { Profile, UserRole } from "@/features/users/types";
import { ROLE_LABELS, ROLE_COLORS } from "@/features/users/types";
import type { AssignClientFields } from "@/features/clients/actions";
import { SearchableSelect } from "@/shared/ui";

type AssignMemberModalProps = {
  open: boolean;
  users: Profile[];
  pending?: boolean;
  current?: {
    assignedTo?: string | null;
    teamLeaderId?: string | null;
    adminId?: string | null;
  };
  onClose: () => void;
  onAssign: (fields: AssignClientFields) => void;
};

function labelFor(u: Profile) {
  return u.full_name || u.email.split("@")[0];
}

function withCurrent(pool: Profile[], selectedId: string, all: Profile[]) {
  if (!selectedId) return pool;
  if (pool.some((u) => u.id === selectedId)) return pool;
  const cur = all.find((u) => u.id === selectedId);
  return cur ? [cur, ...pool] : pool;
}

function RolePicker({
  label,
  hint,
  value,
  options,
  placeholder,
  autoFocus,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  options: Profile[];
  placeholder: string;
  autoFocus?: boolean;
  onChange: (id: string) => void;
}) {
  const selected = options.find((u) => u.id === value) ?? null;
  const rc = selected
    ? ROLE_COLORS[selected.role as UserRole] ?? ROLE_COLORS.viewer
    : null;

  const selectOptions = useMemo(
    () =>
      options.map((u) => ({
        id: u.id,
        label: labelFor(u),
        meta: `${ROLE_LABELS[u.role as UserRole]} · ${u.email}`,
      })),
    [options]
  );

  return (
    <div className="assign-role-slot">
      <div className="assign-role-slot-head">
        <span className="assign-role-label">{label}</span>
        <span className="assign-role-hint">{hint}</span>
      </div>

      {selected && rc ? (
        <div className="assign-role-selected">
          <span
            className="assign-role-avatar"
            style={{
              background: rc.bg,
              color: rc.text,
              borderColor: rc.border,
            }}
          >
            {(selected.full_name || selected.email)[0].toUpperCase()}
          </span>
          <span className="assign-role-selected-meta">
            <span className="assign-role-selected-name">{labelFor(selected)}</span>
            <span className="assign-role-selected-role">
              {ROLE_LABELS[selected.role as UserRole]} · {selected.email}
            </span>
          </span>
        </div>
      ) : null}

      <SearchableSelect
        value={value}
        options={selectOptions}
        onChange={onChange}
        placeholder={placeholder}
        emptyLabel="— None —"
        autoFocus={autoFocus}
        aria-label={label}
      />
    </div>
  );
}

export function AssignMemberModal({
  open,
  users,
  pending = false,
  current,
  onClose,
  onAssign,
}: AssignMemberModalProps) {
  const [assignedTo, setAssignedTo] = useState("");
  const [teamLeaderId, setTeamLeaderId] = useState("");
  const [adminId, setAdminId] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    void Promise.resolve().then(() => {
      setAssignedTo(current?.assignedTo ?? "");
      setTeamLeaderId(current?.teamLeaderId ?? "");
      setAdminId(current?.adminId ?? "");
      setNote("");
    });
  }, [open, current?.assignedTo, current?.teamLeaderId, current?.adminId]);

  const salesOptions = useMemo(
    () =>
      withCurrent(
        users.filter((u) => u.role === "sales"),
        assignedTo,
        users
      ),
    [users, assignedTo]
  );
  const tlOptions = useMemo(
    () =>
      withCurrent(
        users.filter((u) => u.role === "team_leader"),
        teamLeaderId,
        users
      ),
    [users, teamLeaderId]
  );
  const adminOptions = useMemo(
    () =>
      withCurrent(
        users.filter((u) => u.role === "admin" || u.role === "super_admin"),
        adminId,
        users
      ),
    [users, adminId]
  );

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onAssign({
      assignedTo: assignedTo || null,
      teamLeaderId: teamLeaderId || null,
      adminId: adminId || null,
      note: note.trim() || undefined,
    });
  }

  return (
    <div
      className="picker-backdrop open"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="picker-modal assign-members-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignMemberTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="picker-head">
          <h2 id="assignMemberTitle">Assign members</h2>
          <button
            type="button"
            className="btn btn-ghost picker-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={submit} className="assign-roles-form">
          <p className="assign-roles-intro">
            Click a field to open the list, then type to filter. Each role is
            optional.
          </p>

          <div className="assign-roles-stack">
            <RolePicker
              label="Assigned to"
              hint="Sales"
              value={assignedTo}
              options={salesOptions}
              placeholder="Search sales…"
              autoFocus
              onChange={setAssignedTo}
            />
            <RolePicker
              label="Team Leader"
              hint="Team leader"
              value={teamLeaderId}
              options={tlOptions}
              placeholder="Search team leaders…"
              onChange={setTeamLeaderId}
            />
            <RolePicker
              label="Admin"
              hint="Admin / Super admin"
              value={adminId}
              options={adminOptions}
              placeholder="Search admins…"
              onChange={setAdminId}
            />
          </div>

          <label className="assign-modal-note-label">
            Note (optional)
            <input
              className="search"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a handoff note…"
            />
          </label>

          <div className="assign-modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={pending}
            >
              {pending ? "Saving…" : "Save assignments"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

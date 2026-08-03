"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Profile, UserRole } from "@/features/users/types";
import { ROLE_COLORS } from "@/features/users/types";
import type { CrmClientWithProfiles, ClientStatus } from "@/features/clients/types";
import { STATUS_COLORS, STATUS_LABELS } from "@/features/clients/types";
import { createCrmClient } from "@/features/clients/actions";
import {
  PIPELINE_OPTIONS,
  type PipelineStatus,
} from "@/features/onboarding/types";
import { WorkspaceShell } from "@/features/shell";
import { SearchAutocomplete } from "@/shared/ui";
import { formatDate } from "@/lib/format-date";

const STATUS_FILTERS: { key: ClientStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unassigned", label: "Unassigned" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
  { key: "closed", label: "Closed" },
];

export function ClientsListPage({
  myProfile,
  clients,
}: {
  myProfile: Profile;
  clients: CrmClientWithProfiles[];
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<ClientStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newContact, setNewContact] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPipeline, setNewPipeline] = useState<PipelineStatus>("new");
  const [newClientType, setNewClientType] = useState("");
  const [newBranding, setNewBranding] = useState("");
  const [pending, startTransition] = useTransition();

  const role = myProfile.role as UserRole;
  const canCreate = role !== "viewer";

  const filtered = clients.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function resetCreateForm() {
    setNewName("");
    setNewCompany("");
    setNewContact("");
    setNewPhone("");
    setNewEmail("");
    setNewPipeline("new");
    setNewClientType("");
    setNewBranding("");
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    startTransition(async () => {
      await createCrmClient({
        name: newName.trim(),
        company: newCompany.trim() || undefined,
        contact_person: newContact.trim() || undefined,
        phone: newPhone.trim() || undefined,
        email: newEmail.trim() || undefined,
        pipeline_status: newPipeline,
        client_type: newClientType.trim() || undefined,
        branding: newBranding.trim() || undefined,
      });
      setShowCreate(false);
      resetCreateForm();
      router.refresh();
    });
  }

  return (
    <WorkspaceShell
      title="Clients"
      crumbs={[
        { label: "Boards", href: "/boards/catalog" },
        { label: "Clients" },
      ]}
      projectType="Clients"
      profile={myProfile}
      topExtra={
        <>
          <SearchAutocomplete
            value={search}
            onChange={setSearch}
            suggestions={clients.map((c) => ({
              id: c.id,
              label: c.name,
              meta: c.industry || undefined,
            }))}
            placeholder="Search clients…"
            recentKey="ac:clients"
          />
          <span className="user-chip">
            {filtered.length} client{filtered.length !== 1 ? "s" : ""}
          </span>
          {canCreate && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + New Client
            </button>
          )}
        </>
      }
      sidebarExtra={
        <>
          <div className="nav-section-label" style={{ marginTop: 16 }}>
            Filter
          </div>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`nav-link${statusFilter === f.key ? " active" : ""}`}
              style={{
                border: "none",
                background: "none",
                textAlign: "left",
                width: "100%",
                cursor: "pointer",
              }}
              onClick={() => setStatusFilter(f.key)}
            >
              <span className="ico">○</span> {f.label}
            </button>
          ))}
        </>
      }
    >
      <div className="content">
        {showCreate && (
          <div
            className="picker-backdrop open"
            onClick={() => {
              setShowCreate(false);
              resetCreateForm();
            }}
          >
            <div
              className="picker-modal project-create-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="picker-head">
                <h2>Create client</h2>
                <button
                  type="button"
                  className="btn btn-ghost picker-close"
                  onClick={() => {
                    setShowCreate(false);
                    resetCreateForm();
                  }}
                >
                  ✕
                </button>
              </div>
              <form className="project-create-form" onSubmit={handleCreate}>
                <label className="project-field">
                  <span>Client / Project Name *</span>
                  <input
                    className="search"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Acme Corp launch"
                    required
                    autoFocus
                  />
                </label>
                <label className="project-field">
                  <span>Company</span>
                  <input
                    className="search"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    placeholder="Legal / trading name"
                  />
                </label>
                <label className="project-field">
                  <span>Contact Person</span>
                  <input
                    className="search"
                    value={newContact}
                    onChange={(e) => setNewContact(e.target.value)}
                    placeholder="Primary contact"
                  />
                </label>
                <div className="project-create-row">
                  <label className="project-field">
                    <span>Phone</span>
                    <input
                      className="search"
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="+1 …"
                    />
                  </label>
                  <label className="project-field">
                    <span>Email</span>
                    <input
                      className="search"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="name@company.com"
                    />
                  </label>
                </div>
                <label className="project-field">
                  <span>Pipeline Status</span>
                  <select
                    className="search"
                    value={newPipeline}
                    onChange={(e) =>
                      setNewPipeline(e.target.value as PipelineStatus)
                    }
                  >
                    {PIPELINE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="project-create-row">
                  <label className="project-field">
                    <span>Client Type</span>
                    <input
                      className="search"
                      value={newClientType}
                      onChange={(e) => setNewClientType(e.target.value)}
                      placeholder="e.g. D2C, SaaS"
                    />
                  </label>
                  <label className="project-field">
                    <span>Branding</span>
                    <input
                      className="search"
                      value={newBranding}
                      onChange={(e) => setNewBranding(e.target.value)}
                      placeholder="Tone, colors, notes"
                    />
                  </label>
                </div>
                <div className="assign-modal-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setShowCreate(false);
                      resetCreateForm();
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={pending || !newName.trim()}
                  >
                    {pending ? "Creating…" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="empty-state">
            {search
              ? `No clients match "${search}"`
              : "No clients yet. Create your first client above."}
          </div>
        ) : (
          <table className="sell-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Industry</th>
                <th>Status</th>
                <th>Assigned to</th>
                <th>Team Leader</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const sc = STATUS_COLORS[c.status];
                const assigneeRc = c.assignee
                  ? ROLE_COLORS[c.assignee.role as UserRole]
                  : null;
                return (
                  <tr
                    key={c.id}
                    className="sell-table-row"
                    onClick={() => router.push(`/clients/${c.id}`)}
                  >
                    <td>
                      <div style={{ fontWeight: 650 }}>{c.name}</div>
                    </td>
                    <td style={{ color: "var(--jira-muted)" }}>{c.industry ?? "—"}</td>
                    <td>
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
                    </td>
                    <td>
                      {c.assignee ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: 11,
                              background: assigneeRc?.bg,
                              color: assigneeRc?.text,
                              border: `1px solid ${assigneeRc?.border}`,
                            }}
                          >
                            {(c.assignee.full_name || c.assignee.email)[0].toUpperCase()}
                          </span>
                          {c.assignee.full_name || c.assignee.email.split("@")[0]}
                        </span>
                      ) : (
                        <span style={{ color: "var(--jira-muted)", fontStyle: "italic" }}>
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td style={{ color: "var(--jira-muted)" }}>
                      {c.team_leader?.full_name ||
                        c.team_leader?.email?.split("@")[0] ||
                        "—"}
                    </td>
                    <td style={{ color: "var(--jira-muted)" }}>
                      {formatDate(c.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </WorkspaceShell>
  );
}

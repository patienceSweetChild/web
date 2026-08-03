"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Profile, UserRole } from "@/features/users/types";
import { ROLE_LABELS, ROLE_COLORS } from "@/features/users/types";
import type { CrmClientWithProfiles } from "@/features/clients/types";
import { STATUS_COLORS, STATUS_LABELS } from "@/features/clients/types";
import { updateProfile } from "@/features/users/actions";
import { createClient } from "@/lib/supabase/client";
import { WorkspaceShell } from "@/features/shell";
import { formatDate } from "@/lib/format-date";

export function ProfilePage({
  myProfile,
  reports,
  ownClients,
}: {
  myProfile: Profile;
  reports: Profile[];
  ownClients: CrmClientWithProfiles[];
}) {
  const router = useRouter();
  const role = myProfile.role as UserRole;
  const rc = ROLE_COLORS[role];
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(myProfile.full_name ?? "");
  const [phone, setPhone] = useState(myProfile.phone ?? "");
  const [department, setDepartment] = useState(myProfile.department ?? "");
  const [pending, startTransition] = useTransition();

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await updateProfile(myProfile.id, { full_name: fullName, phone, department });
      setEditing(false);
      router.refresh();
    });
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <WorkspaceShell
      title="My Profile"
      crumbs={[
        { label: "Boards", href: "/boards/catalog" },
        { label: "My Profile" },
      ]}
      projectType="My Profile"
      profile={myProfile}
      topExtra={
        <>
          {!editing && (
            <button className="btn" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
          <button className="btn btn-ghost" onClick={handleSignOut}>
            Sign out
          </button>
        </>
      }
    >
      <div className="content">
        <div className="user-detail-header">
          <span
            className="user-detail-avatar"
            style={{
              background: rc.bg,
              color: rc.text,
              border: `2px solid ${rc.border}`,
              fontSize: 28,
            }}
          >
            {(myProfile.full_name || myProfile.email)[0].toUpperCase()}
          </span>
          <div className="user-detail-meta">
            <div className="user-detail-name">
              {myProfile.full_name || myProfile.email.split("@")[0]}
            </div>
            <div className="user-detail-email">{myProfile.email}</div>
            <span
              className="user-detail-role-badge"
              style={{
                background: rc.bg,
                color: rc.text,
                border: `1px solid ${rc.border}`,
              }}
            >
              {ROLE_LABELS[role]}
            </span>
          </div>
          <div className="user-detail-stats">
            <div className="user-stat">
              <span className="user-stat-num">{ownClients.length}</span>
              <span className="user-stat-label">Clients</span>
            </div>
            <div className="user-stat">
              <span className="user-stat-num">{reports.length}</span>
              <span className="user-stat-label">Reports</span>
            </div>
          </div>
        </div>

        {editing ? (
          <form onSubmit={handleSave} style={{ marginTop: 24, maxWidth: 480 }}>
            <div className="admin-section">
              <div className="admin-section-title">Edit Profile</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 600,
                      fontSize: 12,
                      marginBottom: 4,
                    }}
                  >
                    Full name
                  </label>
                  <input
                    className="search"
                    style={{ width: "100%" }}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 600,
                      fontSize: 12,
                      marginBottom: 4,
                    }}
                  >
                    Phone
                  </label>
                  <input
                    className="search"
                    style={{ width: "100%" }}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 …"
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 600,
                      fontSize: 12,
                      marginBottom: 4,
                    }}
                  >
                    Department
                  </label>
                  <input
                    className="search"
                    style={{ width: "100%" }}
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Sales"
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" className="btn btn-primary" disabled={pending}>
                    {pending ? "Saving…" : "Save"}
                  </button>
                  <button type="button" className="btn" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <div style={{ marginTop: 24 }}>
            <div className="admin-section">
              <div className="admin-section-title">Basic Information</div>
              <div className="admin-info-grid">
                <div className="admin-info-row">
                  <span className="admin-info-label">Email</span>
                  <span>{myProfile.email}</span>
                </div>
                <div className="admin-info-row">
                  <span className="admin-info-label">Phone</span>
                  <span>{myProfile.phone ?? "—"}</span>
                </div>
                <div className="admin-info-row">
                  <span className="admin-info-label">Department</span>
                  <span>{myProfile.department ?? "—"}</span>
                </div>
                <div className="admin-info-row">
                  <span className="admin-info-label">Member since</span>
                  <span>{formatDate(myProfile.created_at)}</span>
                </div>
              </div>
            </div>

            {ownClients.length > 0 && (
              <div className="admin-section">
                <div className="admin-section-title">My Clients</div>
                <div className="admin-client-list">
                  {ownClients.slice(0, 5).map((c) => {
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
                      </Link>
                    );
                  })}
                </div>
                {ownClients.length > 5 && (
                  <Link
                    href="/clients"
                    className="btn"
                    style={{ marginTop: 8, display: "inline-block" }}
                  >
                    View all {ownClients.length} clients
                  </Link>
                )}
              </div>
            )}

            {reports.length > 0 && (
              <div className="admin-section">
                <div className="admin-section-title">My Team</div>
                <div className="admin-client-list">
                  {reports.map((r) => {
                    const rrc = ROLE_COLORS[r.role as UserRole];
                    return (
                      <Link key={r.id} href={`/users/${r.id}`} className="admin-client-row">
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: 12,
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
              </div>
            )}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

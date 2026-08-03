"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Profile, UserRole } from "@/features/users/types";
import {
  ROLE_LABELS,
  ROLE_COLORS,
  ASSIGNABLE_ROLES,
  canChangeUserRole,
} from "@/features/users/types";
import { assignRole, setManager, updateBoardPermission } from "@/features/users/actions";
import { UserActivityLog } from "@/features/users/user-activity-log";
import {
  UserBoardAccessTable,
  type UserBoardPerm,
} from "@/features/users/components/user-board-access-table";
import { useUser } from "@/features/users/user-provider";
import { BoardsNavSection } from "@/features/shell/app-nav-sidebar";
import { PageBreadcrumb } from "@/features/shell/page-breadcrumb";
import { WorkspaceRail } from "@/features/shell/workspace-rail";
import { formatDate } from "@/lib/format-date";
import { SearchAutocomplete } from "@/shared/ui";

const BOARDS = [
  { id: 'catalog',        label: 'Board Parent (Catalog)' },
  { id: 'formats',        label: 'Board Child (Formats)' },
  { id: 'clients',        label: 'Client Board' },
  { id: 'sell-channels',  label: 'Sell Channels' },
  { id: 'creative-packs', label: 'Creative Packs' },
  { id: 'problems',       label: 'Problems' },
];

const ALL_ROLES: UserRole[] = ['super_admin', 'admin', 'team_leader', 'sales', 'viewer'];

type Perm = { role: string; board_id: string; can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean };
type UserOverride = {
  user_id: string;
  board_id: string;
  can_view: boolean | null;
  can_create: boolean | null;
  can_edit: boolean | null;
  can_delete: boolean | null;
};
type DetailTab = 'info' | 'activity' | 'access';

function mergeUserBoardPerms(
  role: UserRole,
  boardPerms: Perm[],
  overrides: UserOverride[],
  userId: string
): UserBoardPerm[] {
  const roleRows = boardPerms.filter((p) => p.role === role);
  const byBoard = new Map(
    overrides.filter((o) => o.user_id === userId).map((o) => [o.board_id, o] as const)
  );

  return BOARDS.map((board) => {
    const rp = roleRows.find((p) => p.board_id === board.id);
    const o = byBoard.get(board.id);
    return {
      board_id: board.id,
      can_view: o?.can_view ?? rp?.can_view ?? false,
      can_create: o?.can_create ?? rp?.can_create ?? false,
      can_edit: o?.can_edit ?? rp?.can_edit ?? false,
      can_delete: o?.can_delete ?? rp?.can_delete ?? false,
    };
  });
}

export function AdminPanel({
  myProfile,
  allUsers,
  boardPerms,
  userBoardOverrides = [],
}: {
  myProfile: Profile;
  allUsers: Profile[];
  boardPerms: Perm[];
  userBoardOverrides?: UserOverride[];
}) {
  const router = useRouter();
  const { profile: ctxProfile, unreadCount } = useUser();
  const isSA = myProfile.role === 'super_admin';
  const [activeTab, setActiveTab] = useState<'users' | 'boards'>('users');
  const [detailTab, setDetailTab] = useState<DetailTab>('info');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [search, setSearch] = useState('');
  const [perms, setPerms] = useState<Perm[]>(boardPerms);
  const [pending, startTransition] = useTransition();

  const assignable = ASSIGNABLE_ROLES[myProfile.role];
  const selected =
    selectedUser == null
      ? null
      : allUsers.find((u) => u.id === selectedUser.id) ?? selectedUser;

  const canEditSelected =
    selected != null &&
    canChangeUserRole(myProfile, selected, allUsers);

  const selectedUserBoardPerms = useMemo(() => {
    if (!selected || !isSA) return [];
    return mergeUserBoardPerms(
      selected.role as UserRole,
      boardPerms,
      userBoardOverrides,
      selected.id
    );
  }, [selected, isSA, boardPerms, userBoardOverrides]);

  const q = search.trim().toLowerCase();
  const filteredUsers = allUsers.filter((u) => {
    if (!q) return true;
    return (
      u.email.toLowerCase().includes(q) ||
      (u.full_name?.toLowerCase().includes(q) ?? false)
    );
  });

  function getPerm(role: string, boardId: string) {
    return perms.find((p) => p.role === role && p.board_id === boardId);
  }

  async function handleAssignRole(userId: string, role: UserRole) {
    startTransition(async () => {
      await assignRole(userId, role);
      router.refresh();
    });
  }

  async function handleSetManager(userId: string, managerId: string) {
    startTransition(async () => {
      await setManager(userId, managerId || null);
      router.refresh();
    });
  }

  async function handleTogglePerm(
    role: UserRole,
    boardId: string,
    field: 'can_view' | 'can_create' | 'can_edit' | 'can_delete',
    val: boolean
  ) {
    const updated = perms.map((p) =>
      p.role === role && p.board_id === boardId ? { ...p, [field]: val } : p
    );
    setPerms(updated);
    startTransition(async () => {
      await updateBoardPermission(role, boardId, { [field]: val });
    });
  }

  function selectUser(u: Profile) {
    setSelectedUser(u);
    setDetailTab('info');
  }

  return (
    <div className="app" data-board-id="admin">
      <aside className="rail" aria-label="Global">
        <Link className="rail-logo" href="/boards/catalog" title="OAS">O</Link>
        <WorkspaceRail profile={ctxProfile ?? myProfile} unreadCount={unreadCount} />
        <div className="rail-spacer" />
        <Link className="rail-btn" href="/profile" title="Profile">
          <span className="rail-avatar">
            {((ctxProfile?.full_name || ctxProfile?.email) ?? 'A')[0].toUpperCase()}
          </span>
        </Link>
      </aside>

      <aside className="sidebar admin-sidebar">
        <div className="admin-sidebar-head">
          <span className="admin-sidebar-title">Admin Panel</span>
        </div>
        <div className="admin-boards-nav">
          <BoardsNavSection />
        </div>
        <div className="admin-tab-bar">
          <button
            type="button"
            className={`admin-tab${activeTab === 'users' ? ' active' : ''}`}
            onClick={() => setActiveTab('users')}
          >Users</button>
          {isSA && (
            <button
              type="button"
              className={`admin-tab${activeTab === 'boards' ? ' active' : ''}`}
              onClick={() => setActiveTab('boards')}
            >Board Permissions</button>
          )}
        </div>

        {activeTab === 'users' && (
          <>
            <SearchAutocomplete
              wrapClassName="admin-search-wrap"
              value={search}
              onChange={setSearch}
              suggestions={allUsers.map((u) => ({
                id: u.id,
                label: u.full_name || u.email.split("@")[0],
                meta: u.email,
              }))}
              placeholder="Search users…"
              recentKey="ac:admin-users"
            />
            <div className="admin-user-list">
              {filteredUsers.map((u) => {
                const rc = ROLE_COLORS[u.role as UserRole] ?? ROLE_COLORS.viewer;
                return (
                  <button
                    key={u.id}
                    className={`admin-user-row${selectedUser?.id === u.id ? ' selected' : ''}`}
                    onClick={() => selectUser(u)}
                  >
                    <span
                      className="admin-user-avatar"
                      style={{ background: rc.bg, color: rc.text, border: `1px solid ${rc.border}` }}
                    >
                      {(u.full_name || u.email)[0].toUpperCase()}
                    </span>
                    <span className="admin-user-info">
                      <span className="admin-user-name">{u.full_name || u.email.split('@')[0]}</span>
                      <span className="admin-user-email">{u.email}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="page-heading">
            <PageBreadcrumb
              items={[
                { label: "Boards", href: "/boards/catalog" },
                {
                  label:
                    activeTab === "users"
                      ? "User Management"
                      : "Board Permissions",
                },
              ]}
            />
            <h1 className="page-title">
              {activeTab === "users" ? "User Management" : "Board Permissions"}
            </h1>
          </div>
        </header>

        {activeTab === 'users' && selected && (
          <div className="content">
            <div className="admin-detail-card">
              <div className="admin-detail-header">
                <span
                  className="admin-detail-avatar"
                  style={{
                    background: ROLE_COLORS[selected.role as UserRole]?.bg,
                    color: ROLE_COLORS[selected.role as UserRole]?.text,
                  }}
                >
                  {(selected.full_name || selected.email)[0].toUpperCase()}
                </span>
                <div className="admin-detail-meta">
                  <div className="admin-detail-name">{selected.full_name || selected.email.split('@')[0]}</div>
                  <div className="admin-detail-email">{selected.email}</div>
                </div>
                <div className="admin-detail-actions">
                  <Link href={`/users/${selected.id}`} className="btn">View Profile</Link>
                </div>
              </div>

              <div className="admin-detail-tabs">
                <button
                  type="button"
                  className={`admin-detail-tab${detailTab === 'info' ? ' active' : ''}`}
                  onClick={() => setDetailTab('info')}
                >
                  Info
                </button>
                <button
                  type="button"
                  className={`admin-detail-tab${detailTab === 'activity' ? ' active' : ''}`}
                  onClick={() => setDetailTab('activity')}
                >
                  Account Activity
                </button>
                {isSA && (
                  <button
                    type="button"
                    className={`admin-detail-tab${detailTab === 'access' ? ' active' : ''}`}
                    onClick={() => setDetailTab('access')}
                  >
                    Access Boards
                  </button>
                )}
              </div>

              {detailTab === 'info' && (
                <>
                  <div className="admin-section">
                    <div className="admin-section-title">Role</div>
                    {!canEditSelected && (
                      <p className="admin-hierarchy-hint">
                        You can’t change this user’s role (equal/higher rank or your manager).
                      </p>
                    )}
                    <div className="admin-role-grid">
                      {ALL_ROLES.map((r) => {
                        const rc = ROLE_COLORS[r];
                        const canAssign =
                          canEditSelected &&
                          (isSA || assignable.includes(r)) &&
                          canChangeUserRole(myProfile, selected, allUsers, r);
                        const isActive = selected.role === r;
                        return (
                          <button
                            key={r}
                            disabled={!canAssign || pending || isActive}
                            onClick={() => handleAssignRole(selected.id, r)}
                            className={`admin-role-card${isActive ? ' active' : ''}${!canAssign ? ' disabled' : ''}`}
                            style={isActive ? { background: rc.bg, borderColor: rc.border, color: rc.text } : {}}
                          >
                            <span className="admin-role-icon">
                              {r === 'super_admin' ? '👑' : r === 'admin' ? '🛡' : r === 'team_leader' ? '🏆' : r === 'sales' ? '💼' : '👁'}
                            </span>
                            <span className="admin-role-label">{ROLE_LABELS[r]}</span>
                            {isActive && <span className="admin-role-check">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="admin-section">
                    <div className="admin-section-title">Reports to (Manager)</div>
                    <select
                      key={selected.id + (selected.manager_id ?? '')}
                      className="admin-select"
                      defaultValue={selected.manager_id ?? ''}
                      disabled={
                        !canEditSelected ||
                        (!isSA && selected.role !== 'team_leader' && selected.role !== 'sales')
                      }
                      onChange={(e) => handleSetManager(selected.id, e.target.value)}
                    >
                      <option value="">— No manager —</option>
                      {allUsers
                        .filter((u) => u.id !== selected.id)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name || u.email.split('@')[0]} · {ROLE_LABELS[u.role as UserRole]}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="admin-section">
                    <div className="admin-section-title">Basic Information</div>
                    <div className="admin-info-grid">
                      <div className="admin-info-row">
                        <span className="admin-info-label">Email</span>
                        <span>{selected.email}</span>
                      </div>
                      <div className="admin-info-row">
                        <span className="admin-info-label">Phone</span>
                        <span>{selected.phone ?? '—'}</span>
                      </div>
                      <div className="admin-info-row">
                        <span className="admin-info-label">Department</span>
                        <span>{selected.department ?? '—'}</span>
                      </div>
                      <div className="admin-info-row">
                        <span className="admin-info-label">Member since</span>
                        <span>{formatDate(selected.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {detailTab === 'activity' && (
                <div className="admin-section">
                  <UserActivityLog userId={selected.id} />
                </div>
              )}

              {detailTab === 'access' && isSA && (
                <div className="admin-section">
                  <UserBoardAccessTable
                    key={selected.id}
                    userId={selected.id}
                    initialPerms={selectedUserBoardPerms}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'users' && !selected && (
          <div className="content">
            <div className="empty-state">Select a user from the list to manage their role and access.</div>
          </div>
        )}

        {activeTab === 'boards' && isSA && (
          <div className="content">
            <p style={{ color: 'var(--jira-muted)', marginBottom: 16, fontSize: 13 }}>
              Configure what each role can do on each board. Changes save immediately.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="sell-table" style={{ minWidth: 700 }}>
                <thead>
                  <tr>
                    <th>Board</th>
                    {ALL_ROLES.map((r) => (
                      <th key={r} style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            background: ROLE_COLORS[r].bg,
                            color: ROLE_COLORS[r].text,
                            padding: '2px 8px',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {ROLE_LABELS[r]}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {BOARDS.map((board) => (
                    <tr key={board.id}>
                      <td style={{ fontWeight: 600 }}>{board.label}</td>
                      {ALL_ROLES.map((role) => {
                        const p = getPerm(role, board.id);
                        return (
                          <td key={role} style={{ textAlign: 'center' }}>
                            <div className="perm-toggles">
                              {(['can_view', 'can_create', 'can_edit', 'can_delete'] as const).map((field) => {
                                const label = field.replace('can_', '')[0].toUpperCase();
                                const active = p?.[field] ?? false;
                                return (
                                  <button
                                    key={field}
                                    title={field.replace('can_', '')}
                                    disabled={pending}
                                    onClick={() => handleTogglePerm(role, board.id, field, !active)}
                                    className={`perm-toggle-btn${active ? ' active' : ''}`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: 12, fontSize: 12, color: 'var(--jira-muted)' }}>
              V = View · C = Create · E = Edit · D = Delete
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

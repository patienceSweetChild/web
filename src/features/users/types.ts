export type UserRole = 'super_admin' | 'admin' | 'team_leader' | 'sales' | 'viewer';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  manager_id: string | null;
  avatar_url: string | null;
  phone: string | null;
  department: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileWithManager extends Profile {
  manager?: Profile | null;
}

export interface ProfileWithTeam extends Profile {
  manager?: Profile | null;
  reports: Profile[];
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  team_leader: 'Team Leader',
  sales: 'Sales',
  viewer: 'Viewer',
};

export const ROLE_COLORS: Record<UserRole, { bg: string; text: string; border: string }> = {
  super_admin: { bg: '#eae6ff', text: '#403294', border: '#c0b6f2' },
  admin:       { bg: '#deebff', text: '#0747a6', border: '#b3d4ff' },
  team_leader: { bg: '#e6fcff', text: '#006b8c', border: '#79e2f2' },
  sales:       { bg: '#e3fcef', text: '#006644', border: '#abf5d1' },
  viewer:      { bg: '#f4f5f7', text: '#6b778c', border: '#dfe1e6' },
};

/** Higher number = higher in hierarchy */
export const ROLE_RANK: Record<UserRole, number> = {
  super_admin: 5,
  admin: 4,
  team_leader: 3,
  sales: 2,
  viewer: 1,
};

/** Roles a given role can assign to others */
export const ASSIGNABLE_ROLES: Record<UserRole, UserRole[]> = {
  super_admin: ['super_admin', 'admin', 'team_leader', 'sales', 'viewer'],
  admin:       ['team_leader', 'sales', 'viewer'],
  team_leader: [],
  sales:       [],
  viewer:      [],
};

/** True if `ancestorId` is in the manager chain above `userId`. */
export function isAncestorOf(
  userId: string,
  ancestorId: string,
  byId: Map<string, Profile> | Record<string, Profile | undefined>,
): boolean {
  const get = (id: string) =>
    byId instanceof Map ? byId.get(id) : byId[id];
  let current = get(userId);
  const seen = new Set<string>();
  while (current?.manager_id) {
    if (current.manager_id === ancestorId) return true;
    if (seen.has(current.manager_id)) break;
    seen.add(current.manager_id);
    current = get(current.manager_id);
  }
  return false;
}

/**
 * Whether `actor` may change `target`'s role (to `nextRole` if provided).
 * Blocks: self, ancestors (parents up the manager chain), equal/higher ranks
 * (unless actor is super_admin), and roles outside ASSIGNABLE_ROLES.
 */
export function canChangeUserRole(
  actor: Profile,
  target: Profile,
  allUsers: Profile[],
  nextRole?: UserRole,
): boolean {
  if (actor.id === target.id) return false;

  const byId = new Map(allUsers.map((u) => [u.id, u]));
  if (isAncestorOf(actor.id, target.id, byId)) return false;

  const actorRank = ROLE_RANK[actor.role];
  const targetRank = ROLE_RANK[target.role];
  // Only super_admin may touch equal-rank peers; nobody may touch a higher rank
  if (actor.role !== 'super_admin' && actorRank <= targetRank) return false;
  if (actorRank < targetRank) return false;

  const assignable = ASSIGNABLE_ROLES[actor.role];
  if (nextRole !== undefined && !assignable.includes(nextRole)) return false;
  if (nextRole === undefined && assignable.length === 0) return false;

  return true;
}

/** Whether this role can access a given route */
export const ROUTE_ACCESS: Record<string, UserRole[]> = {
  '/admin':         ['super_admin', 'admin'],
  '/users':         ['super_admin', 'admin', 'team_leader'],
  '/clients':       ['super_admin', 'admin', 'team_leader', 'sales', 'viewer'],
  '/projects':      ['super_admin', 'admin', 'team_leader', 'sales', 'viewer'],
  '/notifications': ['super_admin', 'admin', 'team_leader', 'sales'],
  '/profile':       ['super_admin', 'admin', 'team_leader', 'sales', 'viewer'],
};

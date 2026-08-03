import type { Profile } from '@/features/users/types';
import type { CrmClient } from '@/features/clients/types';

export type ProjectStatus = 'unassigned' | 'active' | 'on_hold' | 'completed' | 'cancelled';

export type ProjectMemberRole = 'admin' | 'team_leader' | 'sales';

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  client_id: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role_on_project: ProjectMemberRole;
  added_by: string;
  created_at: string;
  user?: Profile | null;
  adder?: Profile | null;
}

export interface ProjectWithRelations extends Project {
  client?: Pick<CrmClient, 'id' | 'name' | 'status' | 'industry'> | null;
  creator?: Profile | null;
  members?: ProjectMember[];
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  unassigned: 'Unassigned',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const PROJECT_STATUS_COLORS: Record<
  ProjectStatus,
  { bg: string; text: string; border: string }
> = {
  unassigned: { bg: '#f4f5f7', text: '#42526e', border: '#dfe1e6' },
  active: { bg: '#e3fcef', text: '#006644', border: '#abf5d1' },
  on_hold: { bg: '#fff7d6', text: '#974f0c', border: '#ffe380' },
  completed: { bg: '#deebff', text: '#0747a6', border: '#b3d4ff' },
  cancelled: { bg: '#ffebe6', text: '#bf2600', border: '#ffbdad' },
};

export const PROJECT_MEMBER_ROLE_LABELS: Record<ProjectMemberRole, string> = {
  admin: 'Admin',
  team_leader: 'Team Leader',
  sales: 'Sales',
};

/** Effective calendar start (YYYY-MM-DD local). */
export function projectCalendarStart(p: Pick<Project, 'start_date' | 'created_at'>): string {
  if (p.start_date) return p.start_date.slice(0, 10);
  return p.created_at.slice(0, 10);
}

/** Inclusive end date; null/empty end → same as start (single day). */
export function projectCalendarEnd(
  p: Pick<Project, 'start_date' | 'end_date' | 'created_at'>
): string {
  if (p.end_date) return p.end_date.slice(0, 10);
  return projectCalendarStart(p);
}

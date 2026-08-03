import type { Profile } from '@/features/users/types';

export type ClientStatus = 'unassigned' | 'active' | 'inactive' | 'closed';

export interface CrmClient {
  id: string;
  name: string;
  industry: string | null;
  status: ClientStatus;
  notes: string | null;
  company?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  pipeline_status?: string | null;
  client_type?: string | null;
  branding?: string | null;
  created_by: string;
  assigned_to: string | null;
  team_leader_id: string | null;
  admin_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmClientWithProfiles extends CrmClient {
  creator?: Profile | null;
  assignee?: Profile | null;
  team_leader?: Profile | null;
  admin?: Profile | null;
}

export interface ClientAssignment {
  id: string;
  client_id: string;
  assignee_id: string;
  assigned_by: string;
  role_at_assign: string;
  note: string | null;
  created_at: string;
  assignee?: Profile | null;
  assigner?: Profile | null;
}

export const STATUS_LABELS: Record<ClientStatus, string> = {
  unassigned: 'Unassigned',
  active: 'Active',
  inactive: 'Inactive',
  closed: 'Closed',
};

export const STATUS_COLORS: Record<ClientStatus, { bg: string; text: string; border: string }> = {
  unassigned: { bg: '#fff7d6', text: '#974f0c', border: '#ffe380' },
  active:     { bg: '#e3fcef', text: '#006644', border: '#abf5d1' },
  inactive:   { bg: '#f4f5f7', text: '#6b778c', border: '#dfe1e6' },
  closed:     { bg: '#ffebe6', text: '#bf2600', border: '#ffbdad' },
};

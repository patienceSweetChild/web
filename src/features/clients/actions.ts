'use server';

import { createClient } from '@/lib/supabase/server';
import type { ClientStatus } from './types';

export type AssignClientFields = {
  /** Sales assignee. `null` clears. Omit to leave unchanged. */
  assignedTo?: string | null;
  /** Team leader. `null` clears. Omit to leave unchanged. */
  teamLeaderId?: string | null;
  /** Admin. `null` clears. Omit to leave unchanged. */
  adminId?: string | null;
  note?: string;
};

export async function createCrmClient(data: {
  name: string;
  industry?: string;
  notes?: string;
  company?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  pipeline_status?: string;
  client_type?: string;
  branding?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get creator's profile to pre-fill team_leader_id / admin_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, manager_id')
    .eq('id', user.id)
    .single();

  const row: Record<string, unknown> = {
    name: data.name.trim(),
    industry: data.industry?.trim() || null,
    notes: data.notes?.trim() || null,
    company: data.company?.trim() || null,
    contact_person: data.contact_person?.trim() || null,
    phone: data.phone?.trim() || null,
    email: data.email?.trim() || null,
    pipeline_status: data.pipeline_status || 'new',
    client_type: data.client_type?.trim() || null,
    branding: data.branding?.trim() || null,
    created_by: user.id,
    status: 'unassigned',
  };

  if (profile?.role === 'sales') {
    row.assigned_to = user.id;
    row.status = 'active';
    if (profile.manager_id) row.team_leader_id = profile.manager_id;
  } else if (profile?.role === 'team_leader') {
    row.team_leader_id = user.id;
    if (profile.manager_id) row.admin_id = profile.manager_id;
  }

  const { data: client, error } = await supabase
    .from('crm_clients')
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return client;
}

/**
 * Assign role-specific members on a client.
 * Legacy: `assignClient(id, assigneeId, note?)` still sets only `assigned_to`.
 */
export async function assignClient(
  clientId: string,
  fieldsOrAssigneeId: AssignClientFields | string,
  legacyNote?: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const fields: AssignClientFields =
    typeof fieldsOrAssigneeId === 'string'
      ? { assignedTo: fieldsOrAssigneeId, note: legacyNote }
      : fieldsOrAssigneeId;

  const hasAssignedTo = 'assignedTo' in fields;
  const hasTeamLeader = 'teamLeaderId' in fields;
  const hasAdmin = 'adminId' in fields;

  if (!hasAssignedTo && !hasTeamLeader && !hasAdmin) {
    throw new Error('Nothing to assign');
  }

  const patch: Record<string, unknown> = {};

  if (hasAssignedTo) {
    patch.assigned_to = fields.assignedTo ?? null;
    patch.status = fields.assignedTo ? 'active' : 'unassigned';
  }
  if (hasTeamLeader) {
    patch.team_leader_id = fields.teamLeaderId ?? null;
  }
  if (hasAdmin) {
    patch.admin_id = fields.adminId ?? null;
  }

  const { error: updateErr } = await supabase
    .from('crm_clients')
    .update(patch)
    .eq('id', clientId);

  if (updateErr) throw new Error(updateErr.message);

  // History row when a sales assignee is set (not when cleared)
  if (hasAssignedTo && fields.assignedTo) {
    const { data: assignee } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', fields.assignedTo)
      .single();

    const { error: assignErr } = await supabase
      .from('client_assignments')
      .insert({
        client_id: clientId,
        assignee_id: fields.assignedTo,
        assigned_by: user.id,
        role_at_assign: assignee?.role ?? 'sales',
        note: fields.note ?? null,
      });

    if (assignErr) throw new Error(assignErr.message);
  }
}

export async function updateClientStatus(clientId: string, status: ClientStatus) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('crm_clients')
    .update({ status })
    .eq('id', clientId);
  if (error) throw new Error(error.message);
}

export async function updateClientNotes(clientId: string, notes: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('crm_clients')
    .update({ notes })
    .eq('id', clientId);
  if (error) throw new Error(error.message);
}

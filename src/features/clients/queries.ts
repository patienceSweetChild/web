import { createClient } from '@/lib/supabase/server';
import type { CrmClient, CrmClientWithProfiles, ClientAssignment, ClientStatus } from './types';

export async function listClients(opts?: {
  status?: ClientStatus;
  assignedTo?: string;
}): Promise<CrmClientWithProfiles[]> {
  const supabase = await createClient();

  let q = supabase
    .from('crm_clients')
    .select(`
      *,
      creator:profiles!crm_clients_created_by_fkey(id,full_name,email,role),
      assignee:profiles!crm_clients_assigned_to_fkey(id,full_name,email,role),
      team_leader:profiles!crm_clients_team_leader_id_fkey(id,full_name,email,role),
      admin:profiles!crm_clients_admin_id_fkey(id,full_name,email,role)
    `)
    .order('created_at', { ascending: false });

  if (opts?.status) q = q.eq('status', opts.status);
  if (opts?.assignedTo) q = q.eq('assigned_to', opts.assignedTo);

  const { data } = await q;
  return (data ?? []) as CrmClientWithProfiles[];
}

export async function getClientById(id: string): Promise<CrmClientWithProfiles | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('crm_clients')
    .select(`
      *,
      creator:profiles!crm_clients_created_by_fkey(id,full_name,email,role),
      assignee:profiles!crm_clients_assigned_to_fkey(id,full_name,email,role),
      team_leader:profiles!crm_clients_team_leader_id_fkey(id,full_name,email,role),
      admin:profiles!crm_clients_admin_id_fkey(id,full_name,email,role)
    `)
    .eq('id', id)
    .single();
  return data as CrmClientWithProfiles | null;
}

export async function getClientAssignments(clientId: string): Promise<ClientAssignment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('client_assignments')
    .select(`
      *,
      assignee:profiles!client_assignments_assignee_id_fkey(id,full_name,email,role),
      assigner:profiles!client_assignments_assigned_by_fkey(id,full_name,email,role)
    `)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  return (data ?? []) as ClientAssignment[];
}

export async function getUnassignedClients(): Promise<CrmClient[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('crm_clients')
    .select('*')
    .is('assigned_to', null)
    .order('created_at', { ascending: false });
  return (data ?? []) as CrmClient[];
}

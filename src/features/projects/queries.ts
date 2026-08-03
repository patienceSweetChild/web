import { createClient } from '@/lib/supabase/server';
import type { ProjectMember, ProjectStatus, ProjectWithRelations } from './types';
import type { ProjectLog } from './log-types';

const PROJECT_SELECT = `
  *,
  client:crm_clients!projects_client_id_fkey(id,name,status,industry),
  creator:profiles!projects_created_by_fkey(id,full_name,email,role,avatar_url,manager_id,phone,department,created_at,updated_at),
  members:project_members(
    *,
    user:profiles!project_members_user_id_fkey(id,full_name,email,role,avatar_url,manager_id,phone,department,created_at,updated_at),
    adder:profiles!project_members_added_by_fkey(id,full_name,email,role,avatar_url,manager_id,phone,department,created_at,updated_at)
  )
`;

export async function listProjects(opts?: {
  status?: ProjectStatus;
  clientId?: string;
}): Promise<ProjectWithRelations[]> {
  const supabase = await createClient();

  let q = supabase
    .from('projects')
    .select(PROJECT_SELECT)
    .order('created_at', { ascending: false });

  if (opts?.status) q = q.eq('status', opts.status);
  if (opts?.clientId) q = q.eq('client_id', opts.clientId);

  const { data } = await q;
  return (data ?? []) as ProjectWithRelations[];
}

export async function getProjectById(id: string): Promise<ProjectWithRelations | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('projects')
    .select(PROJECT_SELECT)
    .eq('id', id)
    .single();
  return data as ProjectWithRelations | null;
}

export async function listProjectsForClient(
  clientId: string
): Promise<ProjectWithRelations[]> {
  return listProjects({ clientId });
}

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('project_members')
    .select(`
      *,
      user:profiles!project_members_user_id_fkey(id,full_name,email,role,avatar_url,manager_id,phone,department,created_at,updated_at),
      adder:profiles!project_members_added_by_fkey(id,full_name,email,role,avatar_url,manager_id,phone,department,created_at,updated_at)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  return (data ?? []) as ProjectMember[];
}

export async function listProjectLogs(projectId: string): Promise<ProjectLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('project_logs')
    .select(`
      *,
      actor:profiles!project_logs_actor_id_fkey(id,full_name,email,role,avatar_url)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[listProjectLogs]', error.message);
    return [];
  }
  return (data ?? []) as ProjectLog[];
}

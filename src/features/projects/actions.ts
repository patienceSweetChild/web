'use server';

import { createClient } from '@/lib/supabase/server';
import type { ProjectMemberRole, ProjectStatus } from './types';

const MANAGE_ROLES = new Set(['super_admin', 'admin', 'team_leader']);
const CREATE_ROLES = new Set(['super_admin', 'admin', 'team_leader', 'sales']);
const ACTIVATE_ROLES = new Set(['super_admin', 'admin']);

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (!profile) throw new Error('Not authenticated');

  return { supabase, user, profile };
}

async function requireCreate() {
  const ctx = await requireAuth();
  if (!CREATE_ROLES.has(ctx.profile.role)) {
    throw new Error('Not allowed');
  }
  return ctx;
}

async function requireManager() {
  const ctx = await requireAuth();
  if (!MANAGE_ROLES.has(ctx.profile.role)) {
    throw new Error('Not allowed');
  }
  return ctx;
}

async function requireActivate() {
  const ctx = await requireAuth();
  if (!ACTIVATE_ROLES.has(ctx.profile.role)) {
    throw new Error('Not allowed');
  }
  return ctx;
}

/** Managers, or sales who created the project (non-status edits). */
async function requireProjectEditor(projectId: string) {
  const ctx = await requireAuth();
  if (MANAGE_ROLES.has(ctx.profile.role)) return ctx;
  if (ctx.profile.role === 'sales') {
    const { data } = await ctx.supabase
      .from('projects')
      .select('created_by')
      .eq('id', projectId)
      .single();
    if (data?.created_by === ctx.user.id) return ctx;
  }
  throw new Error('Not allowed');
}

export async function createProject(data: {
  name: string;
  clientId: string;
  status?: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
  memberIds?: { userId: string; roleOnProject: ProjectMemberRole }[];
}) {
  const { supabase, user, profile } = await requireCreate();

  const name = data.name.trim();
  if (!name) throw new Error('Name is required');
  if (!data.clientId) throw new Error('Client is required');

  const forceUnassigned =
    profile.role === 'sales' || profile.role === 'team_leader';
  const status: ProjectStatus = forceUnassigned
    ? 'unassigned'
    : (data.status ?? 'active');

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      name,
      client_id: data.clientId,
      status,
      start_date: data.startDate || null,
      end_date: data.endDate || null,
      notes: data.notes?.trim() || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (data.memberIds?.length) {
    const rows = data.memberIds.map((m) => ({
      project_id: project.id,
      user_id: m.userId,
      role_on_project: m.roleOnProject,
      added_by: user.id,
    }));
    const { error: memErr } = await supabase.from('project_members').insert(rows);
    if (memErr) throw new Error(memErr.message);
  }

  return project;
}

export async function updateProject(
  projectId: string,
  data: {
    name?: string;
    status?: ProjectStatus;
    clientId?: string;
    startDate?: string | null;
    endDate?: string | null;
    notes?: string | null;
  }
) {
  if (data.status !== undefined) {
    await requireActivate();
  } else {
    await requireProjectEditor(projectId);
  }

  const supabase = await createClient();

  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.status !== undefined) patch.status = data.status;
  if (data.clientId !== undefined) patch.client_id = data.clientId;
  if (data.startDate !== undefined) patch.start_date = data.startDate || null;
  if (data.endDate !== undefined) patch.end_date = data.endDate || null;
  if (data.notes !== undefined) patch.notes = data.notes?.trim() || null;

  const { error } = await supabase.from('projects').update(patch).eq('id', projectId);
  if (error) throw new Error(error.message);
}

export async function updateProjectStatus(projectId: string, status: ProjectStatus) {
  await updateProject(projectId, { status });
}

export async function addProjectMember(
  projectId: string,
  userId: string,
  roleOnProject: ProjectMemberRole
) {
  const { supabase, user } = await requireManager();

  const { error } = await supabase.from('project_members').upsert(
    {
      project_id: projectId,
      user_id: userId,
      role_on_project: roleOnProject,
      added_by: user.id,
    },
    { onConflict: 'project_id,user_id' }
  );

  if (error) throw new Error(error.message);
}

export async function removeProjectMember(projectId: string, userId: string) {
  await requireManager();
  const supabase = await createClient();
  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function updateProjectMemberRole(
  projectId: string,
  userId: string,
  roleOnProject: ProjectMemberRole
) {
  await requireManager();
  const supabase = await createClient();
  const { error } = await supabase
    .from('project_members')
    .update({ role_on_project: roleOnProject })
    .eq('project_id', projectId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

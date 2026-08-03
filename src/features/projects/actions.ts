'use server';

import { createClient } from '@/lib/supabase/server';
import type { ProjectMemberRole, ProjectStatus } from './types';
import { PROJECT_MEMBER_ROLE_LABELS, PROJECT_STATUS_LABELS } from './types';
import { writeProjectLog } from './write-project-log';

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

  await writeProjectLog(supabase, {
    projectId: project.id,
    actorId: user.id,
    action: 'project_created',
    title: 'Project created',
    detail: `Created as ${PROJECT_STATUS_LABELS[status]}`,
    payload: {
      name,
      status,
      client_id: data.clientId,
      member_count: data.memberIds?.length ?? 0,
    },
  });

  if (data.memberIds?.length) {
    await writeProjectLog(supabase, {
      projectId: project.id,
      actorId: user.id,
      action: 'member_added',
      title: `Added ${data.memberIds.length} member${data.memberIds.length === 1 ? '' : 's'}`,
      detail: data.memberIds
        .map((m) => PROJECT_MEMBER_ROLE_LABELS[m.roleOnProject])
        .join(', '),
      payload: { members: data.memberIds },
    });
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
  const ctx =
    data.status !== undefined
      ? await requireActivate()
      : await requireProjectEditor(projectId);

  const { data: before } = await ctx.supabase
    .from('projects')
    .select('name, status, start_date, end_date, notes, client_id')
    .eq('id', projectId)
    .single();

  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.status !== undefined) patch.status = data.status;
  if (data.clientId !== undefined) patch.client_id = data.clientId;
  if (data.startDate !== undefined) patch.start_date = data.startDate || null;
  if (data.endDate !== undefined) patch.end_date = data.endDate || null;
  if (data.notes !== undefined) patch.notes = data.notes?.trim() || null;

  const { error } = await ctx.supabase.from('projects').update(patch).eq('id', projectId);
  if (error) throw new Error(error.message);

  if (data.status !== undefined && before && before.status !== data.status) {
    await writeProjectLog(ctx.supabase, {
      projectId,
      actorId: ctx.user.id,
      action: 'status_changed',
      title: 'Status changed',
      detail: `${PROJECT_STATUS_LABELS[before.status as ProjectStatus] ?? before.status} → ${PROJECT_STATUS_LABELS[data.status]}`,
      payload: { from: before.status, to: data.status },
    });
  }

  if (data.name !== undefined && before && before.name !== data.name.trim()) {
    await writeProjectLog(ctx.supabase, {
      projectId,
      actorId: ctx.user.id,
      action: 'name_updated',
      title: 'Name updated',
      detail: `${before.name} → ${data.name.trim()}`,
      payload: { from: before.name, to: data.name.trim() },
    });
  }

  if (data.startDate !== undefined || data.endDate !== undefined) {
    const nextStart =
      data.startDate !== undefined ? data.startDate || null : before?.start_date;
    const nextEnd =
      data.endDate !== undefined ? data.endDate || null : before?.end_date;
    if (
      nextStart !== before?.start_date ||
      nextEnd !== before?.end_date
    ) {
      await writeProjectLog(ctx.supabase, {
        projectId,
        actorId: ctx.user.id,
        action: 'dates_updated',
        title: 'Dates updated',
        detail: `${nextStart ?? '—'} → ${nextEnd ?? '—'}`,
        payload: {
          from: { start: before?.start_date, end: before?.end_date },
          to: { start: nextStart, end: nextEnd },
        },
      });
    }
  }

  if (data.notes !== undefined && before && (before.notes ?? '') !== (data.notes?.trim() || '')) {
    await writeProjectLog(ctx.supabase, {
      projectId,
      actorId: ctx.user.id,
      action: 'notes_updated',
      title: 'Notes updated',
      detail: data.notes?.trim() ? 'Notes were edited' : 'Notes cleared',
    });
  }
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', userId)
    .single();

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

  const who = profile?.full_name || profile?.email?.split('@')[0] || 'Member';
  await writeProjectLog(supabase, {
    projectId,
    actorId: user.id,
    action: 'member_added',
    title: 'Member added',
    detail: `${who} as ${PROJECT_MEMBER_ROLE_LABELS[roleOnProject]}`,
    payload: { user_id: userId, role_on_project: roleOnProject },
  });
}

export async function removeProjectMember(projectId: string, userId: string) {
  const { supabase, user } = await requireManager();

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', userId)
    .single();

  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);

  const who = profile?.full_name || profile?.email?.split('@')[0] || 'Member';
  await writeProjectLog(supabase, {
    projectId,
    actorId: user.id,
    action: 'member_removed',
    title: 'Member removed',
    detail: who,
    payload: { user_id: userId },
  });
}

export async function updateProjectMemberRole(
  projectId: string,
  userId: string,
  roleOnProject: ProjectMemberRole
) {
  const { supabase, user } = await requireManager();

  const [{ data: existing }, { data: profile }] = await Promise.all([
    supabase
      .from('project_members')
      .select('role_on_project')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single(),
    supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .single(),
  ]);

  const { error } = await supabase
    .from('project_members')
    .update({ role_on_project: roleOnProject })
    .eq('project_id', projectId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);

  const who = profile?.full_name || profile?.email?.split('@')[0] || 'Member';
  const fromRole = existing?.role_on_project as ProjectMemberRole | undefined;
  await writeProjectLog(supabase, {
    projectId,
    actorId: user.id,
    action: 'member_role_changed',
    title: 'Member role changed',
    detail: fromRole
      ? `${who}: ${PROJECT_MEMBER_ROLE_LABELS[fromRole]} → ${PROJECT_MEMBER_ROLE_LABELS[roleOnProject]}`
      : `${who} → ${PROJECT_MEMBER_ROLE_LABELS[roleOnProject]}`,
    payload: {
      user_id: userId,
      from: fromRole,
      to: roleOnProject,
    },
  });
}

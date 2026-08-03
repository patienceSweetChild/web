'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from './types';
import { ASSIGNABLE_ROLES, canChangeUserRole } from './types';
import type { Profile } from './types';

export async function assignRole(targetUserId: string, role: UserRole) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const [{ data: actor }, { data: target }, { data: allUsers }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('profiles').select('*').eq('id', targetUserId).single(),
    supabase.from('profiles').select('*'),
  ]);

  if (!actor || !target) throw new Error('User not found');

  if (!canChangeUserRole(actor as Profile, target as Profile, (allUsers ?? []) as Profile[], role)) {
    throw new Error('You cannot change this user’s role');
  }

  if (!ASSIGNABLE_ROLES[actor.role as UserRole]?.includes(role)) {
    throw new Error('Role is not assignable by your account');
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', targetUserId);
  if (error) throw new Error(error.message);
}

export async function setManager(targetUserId: string, managerId: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: actor } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (!actor) throw new Error('Not authenticated');

  const { data: target } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', targetUserId)
    .single();
  if (!target) throw new Error('User not found');

  // Same hierarchy gate: cannot reassign managers for equal/higher or parent users
  const { data: allUsers } = await supabase.from('profiles').select('*');
  if (!canChangeUserRole(actor as Profile, target as Profile, (allUsers ?? []) as Profile[])) {
    throw new Error('You cannot change this user’s manager');
  }

  const { error } = await supabase
    .from('profiles')
    .update({ manager_id: managerId })
    .eq('id', targetUserId);
  if (error) throw new Error(error.message);
}

export async function updateProfile(userId: string, fields: {
  full_name?: string;
  phone?: string;
  department?: string;
  avatar_url?: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

export async function updateBoardPermission(
  role: UserRole,
  boardId: string,
  perms: { can_view?: boolean; can_create?: boolean; can_edit?: boolean; can_delete?: boolean }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('role_board_permissions')
    .update({ ...perms, updated_at: new Date().toISOString() })
    .eq('role', role)
    .eq('board_id', boardId);
  if (error) throw new Error(error.message);
}

type BoardPermField = "can_view" | "can_create" | "can_edit" | "can_delete";

/**
 * Super Admin-only: sets per-user overrides on a board.
 * If the override value matches the role default, we clear that field (set to NULL).
 */
export async function updateUserBoardPermission(
  targetUserId: string,
  boardId: string,
  field: BoardPermField,
  val: boolean
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: actor } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!actor || actor.role !== "super_admin") throw new Error("Not allowed");

  const { data: target } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", targetUserId)
    .single();

  if (!target) throw new Error("Target user not found");

  const { data: rolePerm } = await supabase
    .from("role_board_permissions")
    .select("*")
    .eq("role", target.role)
    .eq("board_id", boardId)
    .single();

  if (!rolePerm) throw new Error("Role permissions not configured for board");

  const roleDefault = rolePerm[field] as boolean;
  const nextOverrideValue = val === roleDefault ? null : val;

  const { data: existing } = await supabase
    .from("user_board_permissions")
    .select("*")
    .eq("user_id", targetUserId)
    .eq("board_id", boardId)
    .maybeSingle();

  const merged = {
    can_view: (existing?.can_view ?? null) as boolean | null,
    can_create: (existing?.can_create ?? null) as boolean | null,
    can_edit: (existing?.can_edit ?? null) as boolean | null,
    can_delete: (existing?.can_delete ?? null) as boolean | null,
    [field]: nextOverrideValue,
  } as const;

  const shouldClearRow =
    merged.can_view === null &&
    merged.can_create === null &&
    merged.can_edit === null &&
    merged.can_delete === null;

  if (shouldClearRow) {
    if (existing) {
      const { error } = await supabase
        .from("user_board_permissions")
        .delete()
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    }
    return;
  }

  if (existing) {
    const patch = {
      ...merged,
      updated_by: actor.id,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("user_board_permissions")
      .update(patch)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const insert = {
      user_id: targetUserId,
      board_id: boardId,
      ...merged,
      updated_by: actor.id,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("user_board_permissions").insert(insert);
    if (error) throw new Error(error.message);
  }
}

export type LoginEvent = {
  id: string;
  user_id: string;
  session_key: string | null;
  service_name: string;
  ip_address: string | null;
  user_agent: string | null;
  referrer: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
};

function clientMetaFromHeaders(h: Headers) {
  const forwarded = h.get('x-forwarded-for');
  const ip =
    (forwarded ? forwarded.split(',')[0]?.trim() : null) ||
    h.get('x-real-ip') ||
    null;
  const userAgent = h.get('user-agent');
  const referrer = h.get('referer');
  return { ip, userAgent, referrer };
}

/** Record a login after successful sign-in. */
export async function recordLogin(opts?: {
  userAgent?: string;
  referrer?: string;
  serviceName?: string;
}): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const h = await headers();
  const meta = clientMetaFromHeaders(h);
  const sessionKey =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${user.id}-${Date.now()}`;

  await supabase.from('user_login_events').insert({
    user_id: user.id,
    session_key: sessionKey,
    service_name: opts?.serviceName ?? 'OAS Pin Library',
    ip_address: meta.ip,
    user_agent: opts?.userAgent ?? meta.userAgent,
    referrer: opts?.referrer ?? meta.referrer,
    started_at: new Date().toISOString(),
  });
}

export async function getUserLoginEvents(userId: string): Promise<LoginEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_login_events')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as LoginEvent[];
}

/** End all open sessions for a user except the newest (admin or self). */
export async function clearOtherSessions(userId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: actor } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const isAdmin =
    actor?.role === 'super_admin' || actor?.role === 'admin';
  if (user.id !== userId && !isAdmin) {
    throw new Error('Not allowed');
  }

  const { data: events } = await supabase
    .from('user_login_events')
    .select('id, started_at')
    .eq('user_id', userId)
    .is('ended_at', null)
    .order('started_at', { ascending: false });

  const keepId = events?.[0]?.id;
  const endIds = (events ?? []).filter((e) => e.id !== keepId).map((e) => e.id);
  if (endIds.length === 0) return;

  const { error } = await supabase
    .from('user_login_events')
    .update({ ended_at: new Date().toISOString() })
    .in('id', endIds);
  if (error) throw new Error(error.message);
}

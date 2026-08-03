import { createClient } from '@/lib/supabase/server';
import type { Profile, UserRole } from './types';

export async function getMyProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return data as Profile | null;
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();
  return data as Profile | null;
}

export async function getAllProfiles(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });
  return (data ?? []) as Profile[];
}

/** Returns direct reports of a user */
export async function getDirectReports(managerId: string): Promise<Profile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('manager_id', managerId)
    .order('full_name');
  return (data ?? []) as Profile[];
}

/** Returns all descendants (recursive) — uses DB function */
export async function getDescendants(rootId: string): Promise<Profile[]> {
  const supabase = await createClient();
  const { data: ids } = await supabase.rpc('get_descendants', { root_id: rootId });
  if (!ids || ids.length === 0) return [];

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .in('id', ids.map((r: { id: string }) => r.id));

  return (data ?? []) as Profile[];
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  return count ?? 0;
}

export async function getBoardPermissionsForRole(role: UserRole) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('role_board_permissions')
    .select('*')
    .eq('role', role);
  return data ?? [];
}

export async function getAllBoardPermissions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('role_board_permissions')
    .select('*')
    .order('role')
    .order('board_id');
  return data ?? [];
}

export async function getUserBoardPermissions(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_board_permissions')
    .select('*')
    .eq('user_id', userId);
  return data ?? [];
}

export async function getAllUserBoardPermissions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_board_permissions')
    .select('*');
  return data ?? [];
}

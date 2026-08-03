import { createClient } from '@/lib/supabase/server';
import type { AppNotification } from './types';

export type { AppNotification };

export async function listNotifications(userId: string): Promise<AppNotification[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []) as AppNotification[];
}

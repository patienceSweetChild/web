'use server';

import { createClient } from '@/lib/supabase/server';

export async function markAllRead(userId: string) {
  const supabase = await createClient();
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
}

export async function markOneRead(notifId: string) {
  const supabase = await createClient();
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notifId);
}

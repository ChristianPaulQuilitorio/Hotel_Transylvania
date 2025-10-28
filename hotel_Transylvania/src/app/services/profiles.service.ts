import { supabase } from './supabase.service';

export async function ensureProfile(user: { id: string; email?: string | null; user_metadata?: any }) {
  const id = user.id;
  const email = user.email ?? '';
  const username = (email && email.includes('@')) ? email.split('@')[0] : (user.user_metadata?.username ?? `user_${id.slice(0,8)}`);
  try {
    // Insert minimal profile if missing; do not overwrite existing username/email
    const { error } = await supabase
      .from('profiles')
      .insert({ id, username, email });
    if (error) throw error;
  } catch {
    // ignore errors; profile may already exist or RLS off
  }
}

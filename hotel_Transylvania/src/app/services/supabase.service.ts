import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

const SUPABASE_URL = environment.supabaseUrl;
const SUPABASE_ANON_KEY = environment.supabaseAnonKey;

// DEV workaround: Some browsers/devtools occasionally throw an error when acquiring
// Navigator LockManager for the Supabase auth token. This is non-fatal but noisy.
// To keep the console clean during development, we can disable the LockManager usage
// by providing a minimal shim that immediately runs the callback without locking.
// This reduces multi-tab safety for auth token writes, so avoid for production sites.
try {
  const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (isDev && typeof navigator !== 'undefined' && (navigator as any).locks?.request) {
    const origLocks = (navigator as any).locks;
    if (!(origLocks as any).__patchedForSupabase) {
      (navigator as any).locks = {
        ...origLocks,
        request: async (...args: any[]) => {
          // Support signatures: request(name, callback) or request(name, options, callback)
          const cb = typeof args[1] === 'function' ? args[1] : args[2];
          if (typeof cb === 'function') {
            return await cb({} as any);
          }
          // Fallback to original if unexpected shape
          return await origLocks.request.apply(origLocks, args);
        },
        __patchedForSupabase: true
      };
    }
  }
} catch {}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});

export const signUp = (email: string, password: string) =>
  supabase.auth.signUp({ email, password });

export const signIn = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

export const signOut = () => supabase.auth.signOut();

export const getUser = () => supabase.auth.getUser();

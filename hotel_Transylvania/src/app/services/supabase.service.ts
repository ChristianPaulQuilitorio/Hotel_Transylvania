import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

const SUPABASE_URL = environment.supabaseUrl;
const SUPABASE_ANON_KEY = environment.supabaseAnonKey;

// Workaround: Some browsers or devtools emit a LockManager error when Supabase
// tries to acquire an exclusive lock for the auth token (used to avoid race
// conditions across tabs). The failure is non-fatal but noisy and can surface
// as an uncaught exception. To keep the console clean and avoid breaking the
// app, we patch the Navigator.locks.request function to always fall back to
// running the callback without a lock if the native API throws. This reduces
// multi-tab safety slightly but prevents the runtime error. If you prefer the
// original behavior remove this shim.
try {
  if (typeof navigator !== 'undefined' && (navigator as any).locks && !(navigator as any).locks.__patchedForSupabase) {
    const origLocks = (navigator as any).locks;
    (navigator as any).locks = {
      ...origLocks,
      request: async function (...args: any[]) {
        // Support signatures: request(name, callback) or request(name, options, callback)
        const cb = typeof args[1] === 'function' ? args[1] : args[2];
        try {
          // Try the native API first
          return await (origLocks.request as any).apply(origLocks, args);
        } catch (err) {
          // If the native API throws (lock acquisition failed), run the callback
          // without locking so the library can continue.
          try {
            if (typeof cb === 'function') {
              return await cb({} as any);
            }
          } catch (cbErr) {
            // swallow callback errors to avoid bubbling noisy exceptions
          }
          return { release: () => {} };
        }
      },
      __patchedForSupabase: true
    } as any;
  }
} catch {}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});

export const signUp = (email: string, password: string) => {
  // Redirect directly to the Dashboard after email verification
  // This uses the current origin so it works for localhost and production.
  const redirect = (typeof location !== 'undefined' ? location.origin : '') + '/dashboard';
  return supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirect }
  } as any);
};

export const signIn = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

export const signOut = () => supabase.auth.signOut();

export const getUser = () => supabase.auth.getUser();

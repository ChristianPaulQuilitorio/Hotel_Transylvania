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
  if (typeof navigator !== 'undefined') {
    try {
      const nav: any = navigator;
      // If locks is missing or already patched, set a safe shim or skip
      if (!nav.locks || !nav.locks.__patchedForSupabase) {
        const origLocks = nav.locks;
        // Provide a very defensive request implementation that never throws
        // and will run the callback immediately if locking fails or the
        // native implementation rejects. This prevents noisy exceptions
        // surfaced by some browsers/devtools when Supabase tries to acquire
        // an exclusive lock for auth token handling.
        const safeRequest = async function (...args: any[]) {
          const cbCandidate = args.find((a: any) => typeof a === 'function');
          // First try native implementation if present, but swallow any
          // synchronous or asynchronous errors and ensure a resolved value
          // is always returned.
          try {
            if (origLocks && typeof origLocks.request === 'function') {
              try {
                const res = origLocks.request.apply(origLocks, args);
                // If native returns a promise, await and catch rejection.
                if (res && typeof res.then === 'function') {
                  return await res.catch(async () => {
                    if (typeof cbCandidate === 'function') {
                      try { return await cbCandidate({} as any); } catch { /* ignore */ }
                    }
                    return { release: () => {} };
                  });
                }
                return res;
              } catch (e) {
                // fallthrough to callback below
              }
            }
          } catch (err) {
            // ignore
          }

          // If native locking isn't available or failed, run the callback
          // directly (if provided) and return a no-op release handle.
          try {
            if (typeof cbCandidate === 'function') return await cbCandidate({} as any);
          } catch { /* ignore callback errors */ }
          return { release: () => {} };
        };

        nav.locks = {
          request: safeRequest,
          __patchedForSupabase: true
        } as any;
      }
    } catch (e) {
      // ignore any errors while patching navigator.locks
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

// Create a dedicated admin client that stores its auth session under a
// namespaced localStorage key to avoid clobbering the main app session when
// an admin signs in from the admin portal in the same browser.
const makeNamespacedStorage = (prefix: string) => ({
  getItem: (key: string) => {
    try { return localStorage.getItem(prefix + key); } catch { return null; }
  },
  setItem: (key: string, value: string) => {
    try { localStorage.setItem(prefix + key, value); } catch {}
  },
  removeItem: (key: string) => {
    try { localStorage.removeItem(prefix + key); } catch {}
  }
});

export const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Avoid detecting sessions in the URL for the admin client. When
    // multiple Supabase clients exist in one page, having both attempt to
    // parse session info from the URL can produce concurrent Navigator Lock
    // usages and the "Acquiring an exclusive Navigator LockManager lock"
    // error in some environments. The admin portal does not need URL
    // detection (it signs in within the SPA), so disable it here.
    detectSessionInUrl: false,
    storage: makeNamespacedStorage('admin_') as any
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

// Admin-specific auth helpers (use the namespaced admin client)
export const signUpAdmin = (email: string, password: string) => {
  const redirect = (typeof location !== 'undefined' ? location.origin : '') + '/admin-portal/app';
  return supabaseAdmin.auth.signUp({ email, password, options: { emailRedirectTo: redirect } } as any);
};

export const signInAdmin = (email: string, password: string) =>
  supabaseAdmin.auth.signInWithPassword({ email, password });

export const signOutAdmin = () => supabaseAdmin.auth.signOut();

export const getAdminUser = () => supabaseAdmin.auth.getUser();

/**
 * Returns true when the currently authenticated user is an administrator.
 * Checks both `role === 'admin'` and a legacy `is_admin` boolean flag.
 * By default uses the regular client; set `useAdminClient` to true to use the
 * namespaced `supabaseAdmin` client (admin portal).
 */
export const isAdminUser = async (useAdminClient = false): Promise<boolean> => {
  try {
    const client = useAdminClient ? supabaseAdmin : supabase;
    const { data } = await client.auth.getUser();
    const user = (data as any)?.user;
    if (!user || !user.id) return false;
    const { data: profile, error } = await client.from('profiles').select('role,is_admin').eq('id', user.id).maybeSingle();
    if (error) return false;
    const p = profile as any;
    return (p && ((p.role === 'admin') || (p.is_admin === true)));
  } catch (e) {
    return false;
  }
};

// Expose the client for quick debugging in browser DevTools.
// Usage in console: `window.supabase` or just `supabase` after assigning.
try {
  if (typeof window !== 'undefined') {
    // attach under a distinctive name to avoid collisions
    (window as any).supabase = supabase;
    (window as any).supabaseAdmin = supabaseAdmin;
  }
} catch (e) {
  // ignore in case of non-browser environments or strict CSP
}

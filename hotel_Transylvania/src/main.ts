// Defensive shim for Navigator LockManager: some environments throw when
// attempting to acquire an exclusive lock (used by Supabase auth). Patch
// navigator.locks.request to fall back to running the callback without a
// lock when the native API throws. This must run before any modules that
// import @supabase/supabase-js so we use dynamic imports for the app.
try {
  if (typeof navigator !== 'undefined') {
    try {
      const nav: any = navigator;
      // If locks is missing, or already patched, create/replace with a safe
      // implementation that never throws and always returns a resolved
      // promise with a release() no-op. This is intentionally aggressive so
      // it runs before any other module can attempt to use locks.
      if (!nav.locks || !nav.locks.__patchedForSupabase) {
        const origLocks = nav.locks;
        const safeRequest = async function (...args: any[]) {
          const cb = args.find((a: any) => typeof a === 'function');
          try {
            if (origLocks && typeof origLocks.request === 'function') {
              try {
                const res = origLocks.request.apply(origLocks, args);
                if (res && typeof res.then === 'function') {
                  return await res.catch(async () => {
                    if (typeof cb === 'function') return await cb({} as any);
                    return { release: () => {} };
                  });
                }
                return res;
              } catch (_) {
                // fallthrough to callback
              }
            }
          } catch (_) {}
          try {
            if (typeof cb === 'function') return await cb({} as any);
          } catch (_) {}
          return { release: () => {} };
        };
        nav.locks = {
          request: safeRequest,
          __patchedForSupabase: true
        } as any;
      }
    } catch (e) {
      // swallow any errors during shim installation
    }
  }
} catch {}

// Load the Angular app after the shim so the Supabase client (if imported)
// sees the patched LockManager.
(async () => {
  try {
    const [{ bootstrapApplication } , appModule] = await Promise.all([
      import('@angular/platform-browser'),
      Promise.resolve() // placeholder so we can await the next imports together
    ] as any);
    const { appConfig } = await import('./app/app.config');
    const { AppComponent } = await import('./app/app.component');
    await bootstrapApplication(AppComponent, appConfig);
  } catch (err) {
    console.error(err);
  }
})();

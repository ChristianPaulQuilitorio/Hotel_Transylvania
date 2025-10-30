// Defensive shim for Navigator LockManager: some environments throw when
// attempting to acquire an exclusive lock (used by Supabase auth). Patch
// navigator.locks.request to fall back to running the callback without a
// lock when the native API throws. This must run before any modules that
// import @supabase/supabase-js so we use dynamic imports for the app.
try {
  if (typeof navigator !== 'undefined' && (navigator as any).locks && !(navigator as any).locks.__patchedForSupabase) {
    const origLocks = (navigator as any).locks;
    (navigator as any).locks = {
      ...origLocks,
      request: async function (...args: any[]) {
        const cb = typeof args[1] === 'function' ? args[1] : args[2];
        try {
          return await (origLocks.request as any).apply(origLocks, args);
        } catch (err) {
          try {
            if (typeof cb === 'function') return await cb({} as any);
          } catch (_) {}
          return { release: () => {} };
        }
      },
      __patchedForSupabase: true
    } as any;
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

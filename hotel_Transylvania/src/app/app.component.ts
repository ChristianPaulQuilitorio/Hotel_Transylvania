import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { SettingsService } from './services/settings.service';
import { supabase, signOut } from './services/supabase.service';
import { ensureProfile } from './services/profiles.service';
import { ChatbotComponent } from './chatbot/chatbot.component';
import { TutorialComponent } from './tutorial/tutorial.component';
import { TourComponent } from './tour/tour.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, RouterLink, MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule, MatDividerModule, ChatbotComponent, TutorialComponent, TourComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
  , changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'hotel_Transylvania';
  isAuthenticated = false;
  private authSub: any;
  private _beforeUnloadHandler: any;
  username: string | null = null;
  email: string | null = null;
  currentYear: number = new Date().getFullYear();
  todayISO: string = new Date().toISOString().slice(0, 10);
  // default to true so new installs show the dark theme; actual value is synced from SettingsService in ngOnInit
  darkMode = true;

  get onLanding(): boolean {
    try {
      const path = this.router.url.split('?')[0];
      return path === '/' || path === '/landing';
    } catch {
      return false;
    }
  }

  constructor(private router: Router, private settings: SettingsService) {}

  async ngOnInit() {
    // restore dark mode preference from settings
    try {
      this.darkMode = !!this.settings.get().highContrast;
    } catch {}
    // Tab marker: use sessionStorage to distinguish a reload (same tab)
    // from a fresh/opened tab (sessionStorage is cleared on tab close). If
    // sessionStorage lacks our tab id, treat this as a fresh tab and remove
    // persisted Supabase keys so the SDK won't auto-rehydrate a session.
    try {
      const TAB_KEY = 'app_tab_id_v1';
      const existing = sessionStorage.getItem(TAB_KEY);
      if (!existing) {
        // clear supabase keys from localStorage (best-effort)
        try {
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i) || '';
            if (/^sb-|supabase/i.test(k) || /supabase\.auth/i.test(k)) {
              localStorage.removeItem(k);
            }
          }
        } catch {}
        // mark this tab so reloads keep the marker
        try { sessionStorage.setItem(TAB_KEY, String(Date.now()) + '-' + Math.floor(Math.random()*100000)); } catch {}
      }
    } catch {}
    // initial check
    try {
      const { data } = await supabase.auth.getUser();
      const user = (data as any)?.user;
      this.isAuthenticated = !!user;
      if (user) {
        await ensureProfile(user);
        await this.loadUserInfo(user.id);
        // Do not auto-redirect to the dashboard on initial load. We prefer
        // to land users on the public landing page when they open the app.
        // Navigating to the dashboard will still occur after an explicit
        // sign-in event (see onAuthStateChange below).
      } else {
        this.username = null;
        this.email = null;
        // If there's no signed-in user on initial load, prefer landing page
        try { this.router.navigateByUrl('/'); } catch {}
      }
    } catch (e) {
      this.isAuthenticated = false;
    }

    // subscribe to auth changes
    this.authSub = supabase.auth.onAuthStateChange((event: string, session: any) => {
      this.isAuthenticated = !!session?.user;
      if (session?.user) {
        ensureProfile(session.user);
        this.loadUserInfo(session.user.id);
        // After a successful sign-in (including magic-link), route to dashboard if on login/signup/landing
        const path = this.router.url.split('?')[0];
        if (event === 'SIGNED_IN' && (path === '/' || path.startsWith('/login') || path.startsWith('/signup'))) {
          this.router.navigateByUrl('/dashboard');
        }
      } else {
        // Signed out or session expired -> clear user state and navigate to landing page
        // (we prefer landing on reopen; auth-protected routes will still redirect to login as needed)
        this.username = null;
        this.email = null;
        try { this.router.navigateByUrl('/'); } catch {}
      }
    });

    // New user tutorial: show once on first visit
    try {
      const seen = localStorage.getItem('seen_tutorial');
      if (!seen) {
        setTimeout(() => this.openHelp(true), 800);
        localStorage.setItem('seen_tutorial', '1');
      }
    } catch {}

    // Note: we intentionally do NOT clear sessions on beforeunload. The
    // session-clearing logic above runs only when a new tab is opened and
    // sessionStorage lacks the tab marker; this preserves sessions across
    // reloads while still ensuring closed tabs don't leave persistent tokens.
  }

  ngOnDestroy() {
    // unsubscribe
    try {
      this.authSub?.data?.subscription?.unsubscribe?.();
      // For older SDK, call this.authSub?.unsubscribe?.();
      this.authSub?.unsubscribe?.();
    } catch (e) {
      // ignore
    }
    try {
      const h = (window as any)._appBeforeUnloadHandler;
      if (h) window.removeEventListener('beforeunload', h);
    } catch {}
    // no dynamic beforeunload handler to remove
  }

  async loadUserInfo(userId: string) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, email')
        .eq('id', userId)
        .single();
      this.username = (profile as any)?.username ?? null;
      this.email = (profile as any)?.email ?? null;
      // If email missing in profile, fallback to auth session email
      if (!this.email) {
        const { data } = await supabase.auth.getUser();
        this.email = (data as any)?.user?.email ?? null;
      }
    } catch {
      this.username = null;
      const { data } = await supabase.auth.getUser();
      this.email = (data as any)?.user?.email ?? null;
    }
  }

  async logout() {
    await signOut();
    this.isAuthenticated = false;
    this.username = null;
    this.email = null;
    // navigate to landing page
    this.router.navigateByUrl('/');
  }

  toggleDarkMode() {
    this.darkMode = !this.darkMode;
    this.settings.set({ highContrast: this.darkMode });
  }

  openHelp(silent = false) {
    try {
      const el = document.getElementById('helpCanvas');
      if (!el) return;
      // Notify other UI (chat) to close and hide FAB while help is open
      try { window.dispatchEvent(new CustomEvent('app:help-opened')); } catch {}
      document.body.classList.add('offcanvas-help-open');
      // Ensure we remove the helper class when closed
      const onHidden = () => {
        document.body.classList.remove('offcanvas-help-open');
        el.removeEventListener('hidden.bs.offcanvas', onHidden as any);
        try { window.dispatchEvent(new CustomEvent('app:help-closed')); } catch {}
      };
      el.addEventListener('hidden.bs.offcanvas', onHidden as any, { once: true } as any);
      const bootstrapAny = (window as any).bootstrap;
      if (bootstrapAny?.Offcanvas) {
        const off = bootstrapAny.Offcanvas.getOrCreateInstance(el);
        off.show();
      } else if (!silent && bootstrapAny) {
        const off = new bootstrapAny.Offcanvas(el);
        off.show();
      } else if (!silent) {
        el.classList.add('show');
        (el as HTMLElement).style.visibility = 'visible';
      }
    } catch {}
  }
}

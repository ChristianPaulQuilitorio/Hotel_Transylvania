import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { Router, RouterLink } from '@angular/router';
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
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'hotel_Transylvania';
  isAuthenticated = false;
  private authSub: any;
  username: string | null = null;
  email: string | null = null;
  currentYear: number = new Date().getFullYear();
  todayISO: string = new Date().toISOString().slice(0, 10);
  darkMode = false;

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
    // initial check
    try {
      const { data } = await supabase.auth.getUser();
      const user = (data as any)?.user;
      this.isAuthenticated = !!user;
      if (user) {
        await ensureProfile(user);
        await this.loadUserInfo(user.id);
        // If user landed here via email verification, take them to the dashboard
        const path = this.router.url.split('?')[0];
        if (path === '/' || path.startsWith('/login') || path.startsWith('/signup')) {
          this.router.navigateByUrl('/dashboard');
        }
      } else {
        this.username = null;
        this.email = null;
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
        this.username = null;
        this.email = null;
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

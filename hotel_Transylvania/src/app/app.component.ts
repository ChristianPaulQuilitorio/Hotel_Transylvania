import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { Router, RouterLink } from '@angular/router';
import { supabase, signOut } from './services/supabase.service';
import { ensureProfile } from './services/profiles.service';
import { ChatbotComponent } from './chatbot/chatbot.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, RouterLink, MatToolbarModule, MatButtonModule, ChatbotComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'hotel_Transylvania';
  isAuthenticated = false;
  private authSub: any;
  username: string | null = null;
  email: string | null = null;

  constructor(private router: Router) {}

  async ngOnInit() {
    // initial check
    try {
      const { data } = await supabase.auth.getUser();
      const user = (data as any)?.user;
      this.isAuthenticated = !!user;
      if (user) {
        await ensureProfile(user);
        await this.loadUserInfo(user.id);
      } else {
        this.username = null;
        this.email = null;
      }
    } catch (e) {
      this.isAuthenticated = false;
    }

    // subscribe to auth changes
    this.authSub = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      this.isAuthenticated = !!session?.user;
      if (session?.user) {
        ensureProfile(session.user);
        this.loadUserInfo(session.user.id);
      } else {
        this.username = null;
        this.email = null;
      }
    });
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
}

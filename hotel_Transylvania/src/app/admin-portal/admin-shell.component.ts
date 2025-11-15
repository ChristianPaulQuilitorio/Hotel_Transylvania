import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { AdminService } from '../admin/admin.service';
import { signOutAdmin } from '../services/supabase.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, MatToolbarModule, MatIconModule, MatButtonModule, MatCardModule],
  styles: [
    `:host { display:block }
    /* Nav card grid */
    .nav-grid { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
    .nav-card { cursor:pointer; min-width:96px; text-align:center; padding:8px; border-radius:8px; }
    .nav-card:focus { outline: 3px solid rgba(155,216,58,0.18); }
    .nav-card mat-card-title { font-weight:600; }
    .logout-card { background: transparent; }
    @media (max-width:768px) { .nav-grid { flex-direction:column; } }
    `
  ],
  template: `
  <mat-toolbar color="primary" class="admin-shell-toolbar">
    <mat-toolbar-row>
      <button mat-icon-button *ngIf="showBack" (click)="back()" aria-label="Back">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <mat-icon aria-hidden="true">admin_panel_settings</mat-icon>
      <span>Admin Portal</span>
    </mat-toolbar-row>
  </mat-toolbar>

  <!-- Navigation card: clickable material cards for each section -->
  <mat-card class="admin-card" role="navigation" aria-label="Admin sections">
    <mat-card-content>
      <div class="nav-grid">
        <mat-card class="nav-card" tabindex="0" role="button" aria-label="Users" (click)="go('users')" (keydown.enter)="go('users')">
          <mat-card-title>Users</mat-card-title>
        </mat-card>

        <mat-card class="nav-card" tabindex="0" role="button" aria-label="Bookings" (click)="go('bookings')" (keydown.enter)="go('bookings')">
          <mat-card-title>Bookings</mat-card-title>
        </mat-card>

        <mat-card class="nav-card" tabindex="0" role="button" aria-label="Analytics" (click)="go('analytics')" (keydown.enter)="go('analytics')">
          <mat-card-title>Analytics</mat-card-title>
        </mat-card>

        <mat-card class="nav-card" tabindex="0" role="button" aria-label="Rooms" (click)="go('rooms')" (keydown.enter)="go('rooms')">
          <mat-card-title>Rooms</mat-card-title>
        </mat-card>

        <mat-card class="nav-card logout-card" tabindex="0" role="button" aria-label="Logout" (click)="logout()" (keydown.enter)="logout()">
          <mat-card-title>Logout</mat-card-title>
        </mat-card>
      </div>
    </mat-card-content>
  </mat-card>

  <!-- Main content area: use semantic element (no extra mat-card) to avoid the pale empty card -->
  <main class="admin-shell-container container content-wrapper" role="main">
    <router-outlet></router-outlet>
  </main>
  `
})
export class AdminShellComponent implements OnInit {
  showBack = false;
  constructor(private router: Router, private admin: AdminService) {}
  ngOnInit(): void {
  // Prefetch users, bookings and analytics so child route/components can
  // render immediately without requiring a user click. We don't await
  // here to avoid blocking the shell render.
  this.admin.getUsers().catch((e) => console.warn('prefetch users failed', e));
  this.admin.getBookings().catch((e) => console.warn('prefetch bookings failed', e));
  this.admin.getHistoryBookings().catch((e) => console.warn('prefetch history bookings failed', e));
  this.admin.getBookingStats().catch((e) => console.warn('prefetch booking stats failed', e));

    // Show back button only on /admin-portal and its app subroutes.
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((ev: any) => {
      const url: string = ev.urlAfterRedirects || ev.url || '';
      // Show back when on the admin-portal landing or app subroutes
      this.showBack = url.startsWith('/admin-portal') && (url === '/admin-portal' || url.startsWith('/admin-portal/app'));
    });
  }
  go(p: string) { this.router.navigate(['/admin-portal','app', p]); }
  back() { this.router.navigate(['/admin-portal']); }
  async logout() {
    try { await signOutAdmin(); } catch {}
    this.router.navigate(['/admin-portal','login']);
  }
}

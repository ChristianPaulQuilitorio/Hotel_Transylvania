import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { supabaseAdmin } from '../services/supabase.service';

@Component({
  selector: 'app-admin-landing',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule],
  styles: [
    `:host { display:block; }
     mat-card.admin-landing-card { background: #fbf7ef; color: #111; padding: 20px; border-radius: 10px; }
     mat-card.admin-landing-card h2 { color: rgba(0,0,0,0.9); margin:0; }
     mat-card.admin-landing-card p { color: rgba(0,0,0,0.7); margin:0; }
     .admin-landing-actions { margin-top:16px; display:flex; gap:8px; }
     .admin-landing-actions button[mat-flat-button] { background:#5a6b2f; color:#fff; }
     .admin-landing-actions button[mat-stroked-button] { color:#222; border-color: rgba(0,0,0,0.12); }
     @media (max-width: 768px) { mat-card.admin-landing-card { padding:16px; } }
    `
  ],
  template: `
    <div class="container mt-5">
      <div class="row justify-content-center">
        <div class="col-12 col-md-8">
          <mat-card class="admin-landing-card">
            <div style="display:flex;align-items:center;gap:12px;">
              <mat-icon aria-hidden="true">admin_panel_settings</mat-icon>
              <div>
                <h2>Admin Portal</h2>
                <p class="mb-0">This area is for administrators only. Click below to sign in.</p>
              </div>
            </div>
            <div class="admin-landing-actions">
              <button mat-flat-button (click)="goLogin()">Sign in</button>
              <button mat-stroked-button (click)="goHome()">Back to site</button>
            </div>
            <div class="mt-3 small" style="color:rgba(0,0,0,0.6);">Sign in with a Supabase admin account (the account's profile must have <code>is_admin = true</code>).</div>
          </mat-card>
        </div>
      </div>
    </div>
  `
})
export class AdminLandingComponent implements OnInit {
  constructor(private router: Router) {}

  async ngOnInit() {
    // Check if user is already authenticated and is admin, redirect to app
    try {
      const { data } = await supabaseAdmin.auth.getUser();
      const user = (data as any)?.user;
      if (user) {
        const { data: profile, error } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', user.id).single();
        if (!error && (profile as any)?.is_admin) {
          this.router.navigate(['/admin-portal', 'app']);
        }
      }
    } catch (e) {
      // Ignore errors, stay on landing
    }
  }

  goLogin() { this.router.navigate(['/admin-portal','login']); }
  goHome() { this.router.navigate(['/']); }
}

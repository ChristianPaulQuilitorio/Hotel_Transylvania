import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { supabaseAdmin, signInAdmin, signUpAdmin } from '../services/supabase.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatTabsModule],
  template: `
    <div class="container mt-5">
      <div class="row justify-content-center">
        <div class="col-12 col-md-6">
          <mat-card>
            <mat-tab-group [(selectedIndex)]="selectedTab">
              <mat-tab label="Login">
                <h3 class="mb-3">Admin Portal Login</h3>
                <form (ngSubmit)="login()">
                  <mat-form-field class="w-100 mb-2">
                    <input matInput placeholder="Email" [(ngModel)]="email" name="email" required />
                  </mat-form-field>
                  <mat-form-field class="w-100 mb-2">
                    <input matInput placeholder="Password" [(ngModel)]="password" name="password" type="password" required />
                  </mat-form-field>
                  <div class="d-flex justify-content-end">
                    <button mat-flat-button color="primary" type="submit">Sign in</button>
                  </div>
                </form>
                <div *ngIf="error" class="text-danger mt-2">{{ error }}</div>
                <div class="mt-3 small text-muted">Sign in with a Supabase account that has an associated profile row with <code>is_admin = true</code>.</div>
              </mat-tab>
              <mat-tab label="Sign Up">
                <h3 class="mb-3">Admin Portal Sign Up</h3>
                <form (ngSubmit)="signup()">
                  <mat-form-field class="w-100 mb-2">
                    <input matInput placeholder="Email" [(ngModel)]="email" name="email" required />
                  </mat-form-field>
                  <mat-form-field class="w-100 mb-2">
                    <input matInput placeholder="Password" [(ngModel)]="password" name="password" type="password" required />
                  </mat-form-field>
                  <div class="d-flex justify-content-end">
                    <button mat-flat-button color="primary" type="submit">Sign up</button>
                  </div>
                </form>
                <div *ngIf="message" class="text-success mt-2">{{ message }}</div>
                <div *ngIf="error" class="text-danger mt-2">{{ error }}</div>
                <div class="mt-3 small text-muted">After signing up, check your email for verification before logging in.</div>
              </mat-tab>
            </mat-tab-group>
          </mat-card>
        </div>
      </div>
    </div>
  `
})
export class AdminLoginComponent {
  email = '';
  password = '';
  error: string | null = null;
  message: string | null = null;
  selectedTab = 0; // 0 for login, 1 for signup
  constructor(private router: Router) {}

  login() {
    this.error = null;
    this.message = null;
    const email = this.email?.trim();
    const pass = this.password || '';
    if (!email || !pass) { this.error = 'Email and password are required'; return; }

    // Sign in using Supabase auth and verify the user's profile has is_admin
    signInAdmin(email, pass).then(async (res: any) => {
      if (res?.error) {
        this.error = res.error.message || 'Sign-in failed';
        return;
      }
      // get the current user and check profile using the admin client (namespaced session)
      const { data } = await supabaseAdmin.auth.getUser();
      const user = (data as any)?.user;
      if (!user) { this.error = 'Sign-in succeeded but user not found'; return; }
      const { data: profile, error } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', user.id).single();
      if (error || !(profile as any)?.is_admin) {
        this.error = 'You are not an administrator';
        // sign out to clear session if desired
        try { await supabaseAdmin.auth.signOut(); } catch {}
        return;
      }
      // navigate to the protected admin app area
      this.router.navigate(['/admin-portal','app']);
    }).catch((err: any) => {
      this.error = (err && err.message) || String(err);
    });
  }

  signup() {
    this.error = null;
    this.message = null;
    const email = this.email?.trim();
    const pass = this.password || '';
    if (!email || !pass) { this.error = 'Email and password are required'; return; }

    signUpAdmin(email, pass).then((res: any) => {
      if (res?.error) {
        this.error = res.error.message || 'Sign-up failed';
        return;
      }
      this.message = 'Sign-up successful! Please check your email for verification before logging in.';
      // Optionally switch to login tab
      this.selectedTab = 0;
    }).catch((err: any) => {
      this.error = (err && err.message) || String(err);
    });
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { supabase } from '../services/supabase.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container text-center mt-5">
      <h1>Welcome to BookSmart</h1>
      <p class="lead">BookSmart not Harder.</p>
      <div class="mt-4">
        <button class="btn btn-primary me-2" (click)="openLogin()">Login</button>
        <button class="btn btn-outline-primary" (click)="openSignup()">Sign up</button>
      </div>
    </div>
  `
})
export class LandingComponent implements OnInit {
  constructor(private router: Router) {}

  async ngOnInit() {
    // If user is already logged in, redirect to dashboard
    try {
      const { data } = await supabase.auth.getUser();
      const user = (data as any)?.user;
      if (user) {
        this.router.navigate(['/dashboard']);
      }
    } catch (e) {
      // ignore errors and stay on landing
      console.warn('supabase getUser failed', e);
    }
  }

  openLogin() {
    // Use router to navigate to root login route; AppComponent will open modal
    this.router.navigate(['/login']);
  }

  openSignup() {
    this.router.navigate(['/signup']);
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { supabase } from '../services/supabase.service';
import { RatingsService } from '../services/ratings.service';

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

    <!-- Featured Bedrooms: continuous, hover-pausing scroller -->
    <section class="container featured-section" role="region" aria-label="Featured bedrooms">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h5 class="mb-0">Featured bedrooms</h5>
      </div>

      <div class="scroller">
        <div class="scroller__track">
          <ng-container *ngFor="let r of duplicatedFeatured">
            <div class="room-card card shadow-sm" role="article" tabindex="0" [attr.aria-label]="r.name + ', ' + r.capacity + ' persons'">
              <img [src]="r.image" [alt]="r.name" class="card-img-top room-img" />
              <div class="card-body py-2">
                <div class="d-flex justify-content-between align-items-center">
                  <span class="fw-semibold">{{ r.name }}</span>
                  <span class="badge bg-success">{{ r.capacity }} pax</span>
                </div>
                <div class="small text-warning mt-1" aria-label="Average rating">
                  <ng-container *ngFor="let s of [1,2,3,4,5]">
                    <span [class.opacity-50]="(ratings[r.id]?.average || 0) < s">★</span>
                  </ng-container>
                  <span class="text-muted ms-1" *ngIf="ratings[r.id] as rr">{{ rr.average | number:'1.1-1' }}</span>
                </div>
                <small class="text-muted d-block mt-1">{{ r.short }}</small>
              </div>
            </div>
          </ng-container>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .scroller { 
      overflow: hidden; 
      position: relative; 
      mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);
      -webkit-mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);
    }
    .scroller__track {
      display: flex;
      gap: 1rem;
      width: max-content;
      animation: scroll var(--scroller-duration, 40s) linear infinite;
      will-change: transform;
    }
  .scroller:hover .scroller__track,
  .scroller:focus-within .scroller__track { animation-play-state: paused; }

    @keyframes scroll {
      from { transform: translateX(0); }
      to { transform: translateX(-50%); }
    }

    .room-card {
      width: 300px;
      min-width: 300px;
      border: 0;
      transition: transform .25s ease, box-shadow .25s ease;
    }
    .room-card:hover {
      transform: translateY(-6px) scale(1.02);
      box-shadow: 0 0.5rem 1.2rem rgba(0,0,0,.15) !important;
    }
  .room-img { height: 180px; object-fit: cover; }

    @media (max-width: 576px) {
      .room-card { width: 240px; min-width: 240px; }
      .room-img { height: 150px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .scroller__track { animation: none; }
    }
    .featured-section { margin-top: 4rem; }
  `]
})
export class LandingComponent implements OnInit {
  constructor(private router: Router, private ratingsSvc: RatingsService) {}

  featured = [
    { id: 1, name: 'Deluxe King', image: 'assets/rooms/bed1.jpg', short: 'Spacious room with king bed', capacity: 2 },
    { id: 2, name: 'Twin Suite', image: 'assets/rooms/bed2.jpg', short: 'Two beds perfect for friends', capacity: 2 },
    { id: 3, name: 'Family Room', image: 'assets/rooms/bed3.jpg', short: 'Ideal for families', capacity: 4 },
    { id: 4, name: 'Queen Standard', image: 'assets/rooms/bed4.jpg', short: 'Comfortable and affordable', capacity: 2 },
    { id: 5, name: 'Executive Suite', image: 'assets/rooms/bed5.jpg', short: 'Premium experience', capacity: 3 },
  ];

  get duplicatedFeatured() {
    // Duplicate the list to create a seamless 50% translate loop
    return [...this.featured, ...this.featured];
  }

  ratings: Record<number, { average: number; count: number }> = {};

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

    // Load ratings summary for featured rooms (best-effort; local fallback in service)
    this.loadRatings();
  }

  private async loadRatings() {
    try {
      for (const r of this.featured) {
        const sum = await this.ratingsSvc.getSummary(r.id);
        this.ratings[r.id] = sum;
      }
    } catch {}
  }

  openLogin() {
    // Use router to navigate to root login route; AppComponent will open modal
    this.router.navigate(['/login']);
  }

  openSignup() {
    this.router.navigate(['/signup']);
  }
}

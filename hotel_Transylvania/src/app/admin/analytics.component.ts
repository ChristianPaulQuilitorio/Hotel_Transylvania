import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from './admin.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div>
      <h5>Analytics</h5>
      <div *ngIf="loading">Loading analytics…</div>
      <div *ngIf="!loading">
        <p>Total bookings: <strong>{{ totalBookings }}</strong></p>
        <div *ngIf="stats.length">
          <h6>Bookings per room</h6>
          <ul class="list-unstyled">
            <li *ngFor="let s of stats">Room {{ s.room_id }}: {{ s.count }}</li>
          </ul>
        </div>
      </div>
    </div>
  `
})
export class AdminAnalyticsComponent implements OnInit {
  loading = false;
  stats: any[] = [];
  totalBookings = 0;
  stats$!: Observable<any[] | null>;

  constructor(private svc: AdminService) {
    this.stats$ = this.svc.stats$;
  }

  ngOnInit(): void {
    this.loading = true;
    // Trigger fetch (AdminShell also prefetches) and react to cached subject
    this.svc.getBookingStats().catch((e) => console.warn('prefetch stats failed', e));
    this.stats$.subscribe((s) => {
      this.stats = s || [];
      this.totalBookings = (this.stats || []).reduce((a, b) => a + (b.count || 0), 0);
      this.loading = false;
    });
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from './admin.service';

@Component({
  selector: 'app-admin-bookings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div>
      <h5>Bookings</h5>
      <div *ngIf="loading">Loading bookings…</div>
      <table class="table table-dark table-striped" *ngIf="!loading">
        <thead><tr><th>Booking</th><th>Room</th><th>User</th><th>Check-in</th><th>Checkout</th><th>Created</th></tr></thead>
        <tbody>
          <tr *ngFor="let b of bookings">
            <td>{{ b.id }}</td>
            <td>{{ b.room_id }}</td>
            <td>{{ b.user_id }}</td>
            <td>{{ b.checkin | date }}</td>
            <td>{{ b.checkout | date }}</td>
            <td>{{ b.created_at | date:'short' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `
})
export class AdminBookingsComponent implements OnInit {
  bookings: any[] = [];
  loading = false;

  constructor(private svc: AdminService) {}

  async ngOnInit() {
    this.loading = true;
    this.bookings = await this.svc.getBookings();
    this.loading = false;
  }
}

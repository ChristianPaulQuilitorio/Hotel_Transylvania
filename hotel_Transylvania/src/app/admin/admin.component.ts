import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="container mt-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h3>Admin Panel</h3>
        <nav>
          <a class="btn btn-outline-secondary btn-sm me-2" routerLink="users">Users</a>
          <a class="btn btn-outline-secondary btn-sm me-2" routerLink="bookings">Bookings</a>
          <a class="btn btn-outline-secondary btn-sm" routerLink="analytics">Analytics</a>
        </nav>
      </div>
      <router-outlet></router-outlet>
    </div>
  `
})
export class AdminComponent {}

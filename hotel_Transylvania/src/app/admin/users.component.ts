import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from './admin.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <h5>Users</h5>
      <div *ngIf="loading">Loading users…</div>
      <table class="table table-dark table-striped" *ngIf="!loading">
        <thead>
          <tr><th>User</th><th>Email</th><th>Role</th><th>Joined</th><th></th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let u of users">
            <td>{{ u.username || u.id }}</td>
            <td>{{ u.email }}</td>
            <td>
              <select [(ngModel)]="u.role" (change)="changeRole(u)">
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </td>
            <td>{{ u.created_at | date:'short' }}</td>
            <td><button class="btn btn-sm btn-outline-danger" (click)="removeProfile(u)">Remove</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  `
})
export class AdminUsersComponent implements OnInit {
  users: any[] = [];
  loading = false;

  constructor(private svc: AdminService) {}

  async ngOnInit() {
    this.loading = true;
    this.users = (await this.svc.getUsers()) || [];
    this.loading = false;
  }

  async changeRole(u: any) {
    try {
      await this.svc.updateUserRole(u.id, u.role);
      // pull fresh list
      this.users = (await this.svc.getUsers()) || [];
    } catch (err) { console.warn('changeRole failed', err); }
  }

  async removeProfile(u: any) {
    if (!confirm('Remove profile record for ' + (u.username || u.email) + '?')) return;
    try {
      const svc = await import('../services/supabase.service');
      const client = (svc as any).supabaseAdmin || (svc as any).supabase;
      await client.from('profiles').delete().eq('id', u.id);
      this.users = await this.svc.getUsers();
    } catch (err) { console.warn('removeProfile failed', err); }
  }
}

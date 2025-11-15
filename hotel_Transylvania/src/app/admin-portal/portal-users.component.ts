import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdminService } from '../admin/admin.service';
import { Observable, firstValueFrom } from 'rxjs';
import { supabaseAdmin } from '../services/supabase.service';
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { Inject } from '@angular/core';

@Component({
  selector: 'app-portal-users',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatCardModule, MatButtonModule, MatToolbarModule, MatIconModule, MatProgressSpinnerModule, MatDialogModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSnackBarModule],
  styles: [
    `:host { display:block }
     mat-card.admin-card { background: #fbf7ef; color:#111; padding:0; border-radius:8px; }
     mat-card.admin-card .mat-toolbar { background:#2b2b2b; color:#fff; }
     .text-muted { color: rgba(0,0,0,0.6); }

     /* Responsive toggle: show stacked cards on small screens, table on larger */
     .stack-view { display: none; }
     .table-view { display: block; }
     table.mat-table { width: 100%; }

     @media (max-width:768px) {
       mat-card.admin-card { margin:8px; }
       .stack-view { display: block; padding: 8px; }
       .table-view { display: none; }
       .user-card { margin: 8px 0; padding: 12px; border-radius: 8px; }
       .user-title { font-weight: 600; font-size: 1rem; }
       .user-meta { color: rgba(0,0,0,0.6); font-size: 0.9rem; margin-top:6px }
     }
    `
  ],
  template: `
    <mat-card class="admin-card">
      <mat-toolbar color="primary">
        <button mat-icon-button (click)="back()" aria-label="Back">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <span style="margin-left:12px; font-weight:600;">Users (Admin Portal)</span>
      </mat-toolbar>

        <div class="content">
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
          <button mat-stroked-button (click)="refresh()">Refresh</button>
        </div>

        <ng-container *ngIf="users$ | async as users; else loading">
          <div *ngIf="!users || users.length === 0" class="text-muted">No users found.</div>

          <div *ngIf="users && users.length">
            <!-- Stack view for mobile -->
            <div class="stack-view" role="list">
              <mat-card class="user-card" *ngFor="let u of users" role="listitem">
                  <div class="user-title">{{ u.username || u.id }}</div>
                  <div class="user-meta">{{ u.email || '-' }}</div>
                  <div class="user-meta">{{ u.created_at ? (u.created_at | date:'short') : '-' }}</div>
                  <div style="margin-top:8px; display:flex;gap:8px;flex-wrap:wrap">
                    <button mat-stroked-button color="primary" (click)="editUser(u)">Edit</button>
                    <button mat-stroked-button color="warn" (click)="deleteUser(u)">Delete</button>
                  </div>
                </mat-card>
            </div>

            <!-- Table view for larger screens -->
            <div class="table-view">
              <table mat-table [dataSource]="users" class="mat-elevation-z1">

                <ng-container matColumnDef="user">
                  <th mat-header-cell *matHeaderCellDef> User </th>
                  <td mat-cell *matCellDef="let u">{{ u.username || u.id }}</td>
                </ng-container>

                <ng-container matColumnDef="email">
                  <th mat-header-cell *matHeaderCellDef> Email </th>
                  <td mat-cell *matCellDef="let u">{{ u.email || '-' }}</td>
                </ng-container>

                <ng-container matColumnDef="joined">
                  <th mat-header-cell *matHeaderCellDef> Joined </th>
                  <td mat-cell *matCellDef="let u">{{ u.created_at ? (u.created_at | date:'short') : '-' }}</td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef> Actions </th>
                  <td mat-cell *matCellDef="let u">
                    <button mat-icon-button aria-label="Edit" (click)="editUser(u)"><mat-icon>edit</mat-icon></button>
                    <button mat-icon-button aria-label="Delete" (click)="deleteUser(u)"><mat-icon>delete</mat-icon></button>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedColumnsWithActions"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumnsWithActions;"></tr>
              </table>
            </div>
          </div>
        </ng-container>

        <ng-template #loading>
          <div style="padding:16px; display:flex; align-items:center; gap:12px;">
            <mat-progress-spinner mode="indeterminate"></mat-progress-spinner>
            <div class="text-muted">Loading users…</div>
          </div>
        </ng-template>
      </div>
    </mat-card>
  `
})
export class PortalUsersComponent implements OnInit {
  users$: Observable<any[] | null>;
  displayedColumns = ['user', 'email', 'joined'];
  displayedColumnsWithActions = ['user', 'email', 'joined', 'actions'];
  constructor(private svc: AdminService, private _dialog: MatDialog, private _snack: MatSnackBar) {
    this.users$ = this.svc.users$;
  }
  ngOnInit(): void {
    // Trigger a fetch if no data yet. AdminShell also prefetches but this
    // ensures the component will initiate loading when navigated directly.
    this.svc.getUsers().catch((e) => console.warn('portal users prefetch failed', e));
  }
  back() { this.svc.refreshUsers(); /* keep cache correct */ window.setTimeout(() => history.back(), 0); }

  async refresh() {
    await this.svc.refreshUsers();
  }


  private _openDialog(user: any) {
    const width = (typeof window !== 'undefined' && window.innerWidth && window.innerWidth < 640) ? '95vw' : '360px';
    return this._dialog.open(UserDialogComponent, { width, data: { user } });
  }

  async editUser(user: any) {
    const dialogRef = this._openDialog(user);
    const res: any = await firstValueFrom(dialogRef.afterClosed());
    if (!res) return;
    try {
      const { data, error } = await supabaseAdmin.from('profiles').update({ username: res.username, email: res.email }).eq('id', user.id).select();
      if (error) throw error;
      this.showSnack('Profile updated');
      await this.svc.refreshUsers();
    } catch (e: any) {
      console.warn('update profile failed', e);
      this.showSnack('Update failed: ' + (e.message || e));
    }
  }

  async deleteUser(user: any) {
    const ok = confirm('Delete profile for ' + (user.username || user.id) + '? This will remove the profile row but will NOT delete the auth user.');
    if (!ok) return;
    try {
      const { data, error } = await supabaseAdmin.from('profiles').delete().eq('id', user.id).select();
      if (error) throw error;
      this.showSnack('Profile deleted');
      await this.svc.refreshUsers();
    } catch (e: any) {
      console.warn('delete profile failed', e);
      this.showSnack('Delete failed: ' + (e.message || e));
    }
  }

  showSnack(msg: string) {
    try { this._snack.open(msg, 'Close', { duration: 4000 }); } catch (_) { alert(msg); }
  }
}

@Component({
  selector: 'app-user-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatCardModule],
  styles: [
    `:host { display:block }
     /* Dialog card background and typography */
     :host .mat-card { background: #fbf7ef; color: #111; border-radius:12px; }
     :host .mat-card-title { color: #111; font-weight:600; }

     /* Form fields: stronger contrast for label, placeholder and input */
     :host .mat-form-field-appearance-fill .mat-form-field-flex { background: #f0ecde; }
     :host .mat-form-field { color: #111; }
     :host .mat-form-field .mat-form-field-label { color: rgba(17,17,17,0.8) !important; }
     :host input.mat-input-element, :host textarea.mat-input-element { color: #111 !important; }
     :host input::placeholder { color: rgba(17,17,17,0.45) !important; }

     /* Underline and focus ring to match brand */
     :host .mat-form-field-underline, :host .mat-form-field-ripple { background-color: rgba(27,27,27,0.12) !important; }
     :host .mat-form-field.mat-focused .mat-form-field-flex { box-shadow: 0 0 0 2px rgba(155,216,58,0.08); }

     /* Buttons inside dialog */
     :host button.mat-button { color: #333; }
     :host button.mat-raised-button { background: var(--brand-ivory); color: #111; box-shadow: 0 4px 8px rgba(0,0,0,0.08); }

     @media (prefers-color-scheme: dark) {
       :host .mat-card { background: #2b2b2b; color: #eee }
       :host .mat-form-field-appearance-fill .mat-form-field-flex { background: #202020; }
       :host .mat-form-field .mat-form-field-label { color: #ccc !important; }
       :host input.mat-input-element { color: #eee !important; }
       :host input::placeholder { color: rgba(255,255,255,0.35) !important; }
       :host button.mat-raised-button { background: #3a3a3a; color: #fff; }
     }
    `
  ],
  template: `
    <mat-card>
      <mat-card-title>{{ data?.user ? 'Edit profile' : 'Create profile for existing user' }}</mat-card-title>
      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="save()">
          <mat-form-field appearance="fill" style="width:100%">
            <mat-label>User id (optional when creating)</mat-label>
            <input matInput formControlName="id" placeholder="uuid (for new profile)" />
          </mat-form-field>
          <mat-form-field appearance="fill" style="width:100%">
            <mat-label>Username</mat-label>
            <input matInput formControlName="username" />
          </mat-form-field>
          <mat-form-field appearance="fill" style="width:100%">
            <mat-label>Email</mat-label>
            <input matInput formControlName="email" />
          </mat-form-field>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
            <button mat-button type="button" (click)="close()">Cancel</button>
            <button mat-raised-button color="primary" type="submit">Save</button>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  `
})
export class UserDialogComponent {
  form: FormGroup;
  constructor(private fb: FormBuilder, public dialogRef: MatDialogRef<UserDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any) {
    const u = data?.user || {};
    this.form = this.fb.group({ id: [u.id || ''], username: [u.username || '', Validators.required], email: [u.email || '', Validators.email] });
  }
  save() { if (this.form.valid) this.dialogRef.close(this.form.value); }
  close() { this.dialogRef.close(null); }
}


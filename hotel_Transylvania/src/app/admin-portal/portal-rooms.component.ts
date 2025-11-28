import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { supabaseAdmin } from '../services/supabase.service';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';
import { AdminService } from '../admin/admin.service';
import { isAdminUser } from '../services/supabase.service';

@Component({
  selector: 'app-portal-rooms',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatCardModule, MatButtonModule, MatToolbarModule, MatIconModule, MatProgressSpinnerModule, MatDialogModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSnackBarModule, MatSelectModule],
  styles: [
    `:host { display:block }
     mat-card.admin-card { background: #fbf7ef; color:#111; padding:0; border-radius:8px; }
     mat-card.admin-card .mat-toolbar { background:#2b2b2b; color:#fff; }
     .text-muted { color: rgba(0,0,0,0.6); }
     table.mat-table { width:100%; }
     .stack-view { display:none }
     @media (max-width:768px) {
       .table-view { display:none }
       .stack-view { display:block; padding:12px }
       .room-card { margin:8px 0; padding:12px; border-radius:8px }
     }
    `
  ],
  template: `
    <mat-card class="admin-card">
      <mat-toolbar color="primary">
        <button mat-icon-button (click)="back()" aria-label="Back"><mat-icon>arrow_back</mat-icon></button>
        <span style="margin-left:12px; font-weight:600;">Rooms (Admin Portal)</span>
      </mat-toolbar>

      <div class="content" style="padding:16px">
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
          <button *ngIf="isAdmin" mat-flat-button color="primary" (click)="createRoom()">Create room</button>
          <button mat-stroked-button (click)="refresh()">Refresh</button>
        </div>

        <ng-container *ngIf="rooms$ | async as rooms; else loading">
          <div *ngIf="!rooms || rooms.length === 0" class="text-muted">No rooms found.</div>

          <div *ngIf="rooms && rooms.length">
            <div class="stack-view">
              <mat-card class="room-card" *ngFor="let r of rooms">
                  <div style="display:flex;gap:12px;align-items:center">
                    <img *ngIf="r.image" [src]="r.image" alt="{{r.name}}" style="width:120px;height:80px;object-fit:cover;border-radius:6px" />
                    <div style="flex:1">
                      <div style="font-weight:600">{{r.name}}</div>
                      <div class="text-muted">{{ r.short || (r.description | slice:0:80) || '-' }}</div>
                      <div style="margin-top:6px" class="text-muted">Capacity: {{r.capacity || '-' }} • Price: {{ r.price | currency:'PHP':'symbol':'1.2-2' }}</div>
                      <div style="margin-top:6px"><strong>Status:</strong> <span class="text-muted">{{ r.status || 'available' }}</span></div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:6px">
                      <button *ngIf="isAdmin" mat-icon-button color="primary" (click)="editRoom(r)"><mat-icon>edit</mat-icon></button>
                      <button *ngIf="isAdmin" mat-icon-button color="warn" (click)="deleteRoom(r)"><mat-icon>delete</mat-icon></button>
                    </div>
                  </div>
                  <!-- mobile labelled actions for better discoverability on small screens -->
                  <div style="margin-top:8px; display:flex;gap:8px;flex-wrap:wrap">
                    <button *ngIf="isAdmin" mat-stroked-button color="primary" (click)="editRoom(r)">Edit</button>
                    <button *ngIf="isAdmin" mat-stroked-button color="warn" (click)="deleteRoom(r)">Delete</button>
                  </div>
                </mat-card>
            </div>

            <div class="table-view">
              <table mat-table [dataSource]="rooms" class="mat-elevation-z1">

                <ng-container matColumnDef="image">
                  <th mat-header-cell *matHeaderCellDef> </th>
                  <td mat-cell *matCellDef="let r"><img *ngIf="r.image" [src]="r.image" alt="" style="width:56px;height:40px;object-fit:cover;border-radius:4px"/></td>
                </ng-container>

                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef> Name </th>
                  <td mat-cell *matCellDef="let r">{{r.name}}</td>
                </ng-container>

                <ng-container matColumnDef="short">
                  <th mat-header-cell *matHeaderCellDef> Short </th>
                  <td mat-cell *matCellDef="let r">{{r.short || '-'}}</td>
                </ng-container>

                <ng-container matColumnDef="capacity">
                  <th mat-header-cell *matHeaderCellDef> Capacity </th>
                  <td mat-cell *matCellDef="let r">{{r.capacity || '-'}}</td>
                </ng-container>

                <ng-container matColumnDef="price">
                  <th mat-header-cell *matHeaderCellDef> Price </th>
                  <td mat-cell *matCellDef="let r">{{r.price | currency:'PHP':'symbol':'1.2-2'}}</td>
                </ng-container>

                

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef> Actions </th>
                  <td mat-cell *matCellDef="let r">
                    <button *ngIf="isAdmin" mat-icon-button aria-label="Edit" (click)="editRoom(r)"><mat-icon>edit</mat-icon></button>
                    <button *ngIf="isAdmin" mat-icon-button aria-label="Delete" (click)="deleteRoom(r)"><mat-icon>delete</mat-icon></button>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
              </table>
            </div>
          </div>
        </ng-container>

        <ng-template #loading>
          <div style="padding:16px; display:flex; align-items:center; gap:12px;">
            <mat-progress-spinner mode="indeterminate"></mat-progress-spinner>
            <div class="text-muted">Loading rooms…</div>
          </div>
        </ng-template>
      </div>
    </mat-card>
  `
})
export class PortalRoomsComponent implements OnInit {
  rooms$: Observable<any[] | null> = of(null);
  displayedColumns = ['image','name','short','capacity','price','actions'];
  isAdmin = false;
  constructor(private _dialog: MatDialog, private _snack: MatSnackBar, private router: Router, private svc: AdminService) {}

  async ngOnInit(): Promise<void> {
    // Assign the cached observable immediately so async pipe can render cached rows
    this.rooms$ = this.svc.rooms$;
    // Kick off fetch early so data arrives as soon as possible (fast-load)
    // First populate from cache/get immediate data, then force a background refresh
    this.svc.getRooms().catch(e => console.warn('load rooms failed', e));

    // Start admin check immediately but don't block initial render.
    // Once admin status is known, run a background refresh so the list
    // updates and CRUD icons appear promptly for admins.
    const adminCheck = this.checkAdminFlag().catch(e => { console.warn('checkAdminFlag failed', e); });
    adminCheck.then(() => {
      this.svc.refreshRooms().catch(e => console.warn('refresh rooms failed', e));
    }).catch(() => {
      // Always attempt a refresh even if admin check fails
      this.svc.refreshRooms().catch(e => console.warn('refresh rooms failed', e));
    });
  }

  private async checkAdminFlag() {
    try {
      this.isAdmin = await isAdminUser(true);
    } catch (e) {
      this.isAdmin = false;
    }
  }

  back() { window.setTimeout(() => history.back(), 0); }

  async loadRooms() {
    try {
      await this.svc.getRooms();
    } catch (e: any) {
      console.warn('loadRooms', e);
      this._snack.open('Failed to load rooms: ' + (e.message || e), 'Close', { duration: 4000 });
      this.rooms$ = of([]);
    }
  }

  async refresh() { await this.loadRooms(); }

  private _openDialog(room: any) {
    // set a responsive width so dialogs are usable on mobile (use vw when narrow)
    const width = (typeof window !== 'undefined' && window.innerWidth && window.innerWidth < 640) ? '95vw' : '520px';
    return this._dialog.open(RoomDialogComponent, { width, data: { room }, maxHeight: '80vh' });
  }

  async createRoom() {
    // For testing, require a signed-in user (authenticated) before allowing uploads.
    // We'll tighten this to admin-only once uploads are verified working.
    let user: any = null;
    try {
      const { data: userData } = await supabaseAdmin.auth.getUser();
      user = (userData as any)?.user;
      if (!user) {
        this._snack.open('Please sign in before creating a room. Redirecting to admin login…', 'Close', { duration: 4000 });
        // give the snack a moment then redirect to admin login within the SPA
        setTimeout(() => this.router.navigate(['/admin-portal','login']), 800);
        return;
      }
    } catch (e) {
      this._snack.open('Please sign in before creating a room. Redirecting to admin login…', 'Close', { duration: 4000 });
      setTimeout(() => this.router.navigate(['/admin-portal','login']), 800);
      return;
    }
    const ref = this._openDialog(null);
    const res: any = await firstValueFrom(ref.afterClosed());
    if (!res) return;
    try {
      // If user uploaded a file, upload to the public bucket and use the public URL
      let imageUrl = res.image || null;
      if (res.imageFile) {
        // Ensure the client has a valid session/token before attempting storage upload.
        // If the access token is missing or expired, storage requests will be
        // unauthenticated and RLS will block the insert with a row-level error.
        const { data: sessionData } = await supabaseAdmin.auth.getSession();
        const accessToken = (sessionData as any)?.session?.access_token;
        if (!accessToken) {
          this._snack.open('Your session is not active — please sign in again before uploading.', 'Close', { duration: 6000 });
          this.router.navigate(['/admin-portal','login']);
          return;
        }

        const file: File = res.imageFile;
        const path = `rooms/${Date.now()}_${file.name.replace(/\s+/g,'_')}`;
        // Debugging: log session and profile state to help diagnose RLS failures
        try {
          console.debug('createRoom: preparing upload', { path });
          console.debug('createRoom: session present?', !!accessToken);
          // attempt to fetch profile is_admin for current user for debugging
          try {
            const { data: prof } = await supabaseAdmin.from('profiles').select('id,is_admin,email').eq('id', user.id).single();
            console.debug('createRoom: profile row', prof);
          } catch (pfErr) {
            console.debug('createRoom: could not read profile row', pfErr);
          }
        } catch (dbgErr) {
          console.debug('createRoom: debug logging failed', dbgErr);
        }
        // ensure we have the freshest token immediately before upload (avoid race)
        try {
          const { data: sessionData2 } = await supabaseAdmin.auth.getSession();
          const tokenPreview = (sessionData2 as any)?.session?.access_token;
          console.debug('createRoom: upload token preview', tokenPreview?.slice?.(0,8), '...', tokenPreview?.slice?.(-8));
        } catch (tokErr) {
          console.debug('createRoom: could not read session token before upload', tokErr);
        }
        // small delay so auth state settles if it's changing
        await new Promise(res => setTimeout(res, 200));

        // include content type and allow upsert to avoid 400 if object exists
        // Use direct fetch upload to avoid supabase-js token races
        const upJson = await this.uploadFileDirect(path, file);
        console.debug('createRoom/direct upload result', upJson);
        const { data: urlData } = supabaseAdmin.storage.from('rooms-attachment').getPublicUrl(path);
        imageUrl = urlData?.publicUrl || imageUrl;
      }
  // parse amenities (comma-separated) into array
  const amenitiesArr = res.amenities ? String(res.amenities).split(',').map((s: string) => s.trim()).filter(Boolean) : null;
  // Use short description (p_short) for RPC payload. The RPCs were updated
  // to accept p_short instead of p_description to match the schema.
  const rpcPayload: any = { p_name: res.name, p_capacity: res.capacity || 1, p_price: res.price || 0, p_short: res.short || res.description || null, p_image: imageUrl, p_amenities: amenitiesArr };
  // Call SECURITY DEFINER RPC to avoid RLS blocking the client
  const { data, error } = await supabaseAdmin.rpc('rpc_create_room', rpcPayload);
      if (error) throw error;
      this._snack.open('Room created', 'Close', { duration: 3000 });
      // Force refresh the admin service cache so the list updates immediately
      await this.svc.refreshRooms();
    } catch (e: any) {
      console.warn('createRoom failed', e);
      const msg = e && (e.message || e.error || JSON.stringify(e)) || String(e);
      if (String(msg).toLowerCase().includes('row-level') || String(msg).toLowerCase().includes('violates row-level')) {
        if (String(msg).toLowerCase().includes('storage upload failed due to row-level')) {
          this._snack.open('Create failed: storage upload blocked by RLS. Run supabase/migrations/20251113_allow_authenticated_storage_objects_upload.sql (admin) or enable a storage.objects INSERT policy for bucket "rooms-attachment".', 'Close', { duration: 10000 });
        } else {
          this._snack.open('Create failed: Row-level security denied the insert. Ensure your RLS policies allow inserts for this role or use a SECURITY DEFINER function.', 'Close', { duration: 7000 });
        }
      } else {
        this._snack.open('Create failed: ' + msg, 'Close', { duration: 6000 });
      }
    }
  }

  async editRoom(room: any) {
    if (!this.isAdmin) { this._snack.open('Only administrators can edit rooms.', 'Close', { duration: 4000 }); return; }
    const ref = this._openDialog(room);
    const res: any = await firstValueFrom(ref.afterClosed());
    if (!res) return;
    try {
      // Handle file upload if present and set image to public URL
      let imageUrl = res.image || room.image || null;
      if (res.imageFile) {
        const file: File = res.imageFile;
        const path = `rooms/${Date.now()}_${file.name.replace(/\s+/g,'_')}`;
        // Use direct fetch upload to avoid token race issues in supabase-js
        const upJson = await this.uploadFileDirect(path, file);
        console.debug('editRoom: direct upload result', upJson);
        const { data: urlData } = supabaseAdmin.storage.from('rooms-attachment').getPublicUrl(path);
        imageUrl = urlData?.publicUrl || imageUrl;
      }
  const amenitiesArr = res.amenities ? String(res.amenities).split(',').map((s: string) => s.trim()).filter(Boolean) : null;
  const rpcUpdate: any = { p_id: room.id, p_name: res.name, p_capacity: res.capacity || 1, p_price: res.price || 0, p_short: res.short || res.description || null, p_image: imageUrl, p_amenities: amenitiesArr };
      const { data, error } = await supabaseAdmin.rpc('rpc_update_room', rpcUpdate);
      if (error) throw error;
      this._snack.open('Room updated', 'Close', { duration: 3000 });
      // Force refresh the admin service cache so the list updates immediately
      await this.svc.refreshRooms();
    } catch (e: any) {
      console.warn('update room failed', e);
      const msg = e && (e.message || e.error || JSON.stringify(e)) || String(e);
      if (String(msg).toLowerCase().includes('row-level') || String(msg).toLowerCase().includes('violates row-level')) {
        if (String(msg).toLowerCase().includes('storage upload failed due to row-level')) {
          this._snack.open('Update failed: storage upload blocked by RLS. Run supabase/migrations/20251113_allow_authenticated_storage_objects_upload.sql (admin) or enable a storage.objects INSERT policy for bucket "rooms-attachment".', 'Close', { duration: 10000 });
        } else {
          this._snack.open('Update failed: Row-level security denied the update. Ensure your RLS policies allow updates for this role or use a SECURITY DEFINER function.', 'Close', { duration: 7000 });
        }
      } else {
        this._snack.open('Update failed: ' + msg, 'Close', { duration: 6000 });
      }
    }
  }

  async deleteRoom(room: any) {
    if (!this.isAdmin) {
      this._snack.open('Only administrators can delete rooms.', 'Close', { duration: 4000 });
      return;
    }
    const ok = confirm('Delete room "' + (room.name || room.id) + '"? This will remove the room record.');
    if (!ok) return;
    try {
      // Use SECURITY DEFINER RPC to perform delete under a privileged role
      const { error } = await supabaseAdmin.rpc('rpc_delete_room', { p_id: room.id });
      if (error) throw error;
      this._snack.open('Room deleted', 'Close', { duration: 3000 });
      // Force refresh after deletion
      await this.svc.refreshRooms();
    } catch (e: any) {
      console.warn('delete room failed', e);
      this._snack.open('Delete failed: ' + (e.message || e), 'Close', { duration: 4000 });
    }
  }

  private async uploadFileDirect(path: string, file: File) {
    // Build form data and POST directly to Supabase Storage endpoint using
    // the current access token and anon key. Returns the parsed JSON response.
    const fd = new FormData();
    fd.append('file', file as any);
    const { data: sdata } = await supabaseAdmin.auth.getSession();
    const token = (sdata as any)?.session?.access_token;
    const url = `${environment.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/rooms-attachment/${path}`;
    const apikey = environment.supabaseAnonKey || (window as any).supabaseKey || '';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey
      },
      body: fd
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error('Direct upload failed: ' + res.status + ' ' + txt);
    }
    return res.json();
  }
}

@Component({
  selector: 'app-room-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatCardModule, MatSelectModule],
  styles: [
    `:host { display:block }
     mat-card { width:100%; box-sizing:border-box }
     /* keep the card within viewport and let content scroll */
     mat-card { max-height: calc(100vh - 120px); overflow: hidden; }
     mat-card-content { max-height: calc(100vh - 220px); overflow: auto; padding-right:8px }
     @media (max-width:600px) {
       mat-card { max-height: calc(100vh - 80px); }
       mat-card-content { max-height: calc(100vh - 180px); }
     }
    `
  ],
  template: `
    <mat-card>
      <mat-card-title>{{ data?.room ? 'Edit room' : 'Create room' }}</mat-card-title>
      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="save()">
          <mat-form-field appearance="fill" style="width:100%">
            <mat-label>Name</mat-label>
            <input matInput formControlName="name" />
          </mat-form-field>

          <div style="width:100%; margin-bottom:8px">
            <label style="display:block;margin-bottom:6px;font-size:12px;color:rgba(0,0,0,0.6)">Image (upload or URL)</label>
            <input type="file" (change)="onFile($event)" accept="image/*" />
            <mat-form-field appearance="fill" style="width:100%; margin-top:8px">
              <mat-label>Or image URL</mat-label>
              <input matInput formControlName="image" placeholder="assets/rooms/bed1.jpg or https://..." />
            </mat-form-field>
            <div *ngIf="previewUrl" style="margin-top:8px">
              <img [src]="previewUrl" alt="preview" style="max-width:160px;max-height:120px;object-fit:cover;border-radius:6px" />
            </div>
          </div>

          <mat-form-field appearance="fill" style="width:100%">
            <mat-label>Short description</mat-label>
            <input matInput formControlName="short" />
          </mat-form-field>

          <mat-form-field appearance="fill" style="width:100%">
            <mat-label>Amenities (comma-separated)</mat-label>
            <input matInput formControlName="amenities" placeholder="Wi-Fi, Air conditioning, Smart TV" />
          </mat-form-field>

          <mat-form-field appearance="fill" style="width:100%">
            <mat-label>Description</mat-label>
            <textarea matInput rows="4" formControlName="description"></textarea>
          </mat-form-field>

          <mat-form-field appearance="fill" style="width:48%; margin-right:4%">
            <mat-label>Capacity</mat-label>
            <input matInput type="number" formControlName="capacity" />
          </mat-form-field>

          <mat-form-field appearance="fill" style="width:48%">
            <mat-label>Price</mat-label>
            <input matInput type="number" formControlName="price" />
          </mat-form-field>

          <mat-form-field appearance="fill" style="width:100%">
            <mat-label>Status</mat-label>
            <mat-select formControlName="status">
              <mat-option value="available">Available</mat-option>
              <mat-option value="booked">Booked</mat-option>
            </mat-select>
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
export class RoomDialogComponent {
  form: FormGroup;
  previewUrl: string | null = null;
  constructor(private fb: FormBuilder, public dialogRef: MatDialogRef<RoomDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any) {
    const r = data?.room || {};
    this.form = this.fb.group({
      name: [r.name || '', Validators.required],
      image: [r.image || ''],
      imageFile: [null],
      short: [r.short || ''],
      amenities: [Array.isArray((r as any).amenities) ? (r as any).amenities.join(', ') : ((r as any).amenities || '')],
      description: [r.description || ''],
      capacity: [r.capacity ?? 1, [Validators.min(1)]],
      price: [r.price ?? 0, [Validators.min(0)]],
      status: [r.status || 'available']
    });
    if (r.image) this.previewUrl = r.image;
  }
  onFile(ev: any) {
    const f: File = ev?.target?.files?.[0] || null;
    if (!f) return;
    this.form.patchValue({ imageFile: f });
    try { this.previewUrl = URL.createObjectURL(f); } catch { this.previewUrl = null; }
  }
  save() { if (this.form.valid) this.dialogRef.close(this.form.value); }
  close() { this.dialogRef.close(null); }
}

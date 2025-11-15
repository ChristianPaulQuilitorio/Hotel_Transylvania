import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router } from '@angular/router';
import { AdminService } from '../admin/admin.service';
import { Observable, Subscription } from 'rxjs';
import { supabaseAdmin } from '../services/supabase.service';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-portal-bookings',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatToolbarModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
  ],
  styles: [
    `:host { display:block }
     mat-card.admin-card { background: #fbf7ef; color:#111; padding:0; border-radius:8px; }
     mat-card.admin-card .mat-toolbar { background:#2b2b2b; color:#fff; }
     mat-card.admin-card .mat-elevation-z1 { box-shadow: none; }
     .admin-card .mat-table { background: transparent; }
     .text-muted { color: rgba(0,0,0,0.6); }
     .toolbar-actions { display:flex; gap:8px; align-items:center; }
     .toolbar-toggle { border-radius:20px; padding:6px 12px; font-size:13px; min-width:72px; }
     .toolbar-toggle.mat-button { border: 1px solid rgba(255,255,255,0.12); color: #fff; }
     @media (max-width:768px) { mat-card.admin-card { margin:8px; } }
     .stack-view { display: none; }
     .table-view { display: block; }
     @media (max-width: 720px) {
       .stack-view { display: block; }
       .table-view { display: none; }
       .booking-card mat-card { padding: 12px; }
       .toolbar-actions button { padding:6px 10px; font-size:13px; min-width:64px; }
     }
    `,
  ],
  template: `
    <mat-card class="admin-card">
      <mat-toolbar color="primary" class="mat-elevation-z2" style="display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center">
          <button mat-icon-button (click)="back()" aria-label="Back">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <span style="margin-left:12px; font-weight:600;">Bookings (Admin Portal)</span>
        </div>
        <div class="toolbar-actions" style="display:flex;gap:8px;align-items:center">
          <!-- Toolbar actions reserved (moved history toggle below content) -->
        </div>
      </mat-toolbar>

      <div class="content">
        <div style="display:flex;justify-content:flex-end;padding:8px 16px">
          <button mat-button class="toolbar-toggle" (click)="toggleHistory()">{{ showHistory ? 'Show Active' : 'Show History' }}</button>
        </div>
        <ng-template #loading>
          <div style="padding:16px; display:flex; align-items:center; gap:12px;">
            <mat-progress-spinner mode="indeterminate"></mat-progress-spinner>
            <div class="text-muted">Loading bookings…</div>
          </div>
        </ng-template>

        <div *ngIf="(showHistory ? history !== null : bookings !== null); else loading">
          <div *ngIf="showHistory ? (!history || history.length === 0) : (!bookings || bookings.length === 0)" class="text-muted" style="padding:16px">No bookings found.</div>

          <div *ngIf="showHistory ? (history && history.length) : (bookings && bookings.length)">
          <div class="stack-view">
            <div *ngFor="let b of (showHistory ? historyBookings : activeBookings)" class="booking-card" style="margin-bottom:12px;">
              <mat-card>
                <div class="booking-row">
                  <div class="booking-room">
                    <ng-container *ngIf="showHistory; else activeRoomLabel">
                      {{ b.rooms?.name || b.rooms?.id || b.room_id || roomName(b) }}
                    </ng-container>
                    <ng-template #activeRoomLabel>{{ 'Room: ' + (b.rooms?.name || b.rooms?.id || b.room_id || roomName(b)) }}</ng-template>
                  </div>
                  <div class="small text-muted">{{ b.created_at | date:'short' }}</div>
                </div>
                <div class="booking-meta">User: <strong>{{ b.username || '' }}</strong></div>
                <div class="booking-meta">Check-in: {{ b.checkin_date | date }}</div>
                <div class="booking-meta">Check-out: {{ b.checkout_date | date }}</div>
                <div class="booking-meta">Status: <strong>{{ b.status || '-' }}</strong></div>
                <div style="margin-top:8px; display:flex;gap:8px;flex-wrap:wrap">
                  <!-- Actions removed for condensed mobile/card view -->
                </div>
              </mat-card>
            </div>
          </div>

          <div class="table-view admin-table-container" style="padding:8px 16px">
            <table mat-table [dataSource]="(showHistory ? historyBookings : activeBookings)" class="mat-elevation-z1" style="width:100%">

              <ng-container matColumnDef="bookingDate">
                <th mat-header-cell *matHeaderCellDef> Booking date </th>
                <td mat-cell *matCellDef="let b">{{ b.created_at | date:'short' }}</td>
              </ng-container>

              <ng-container matColumnDef="room">
                <th mat-header-cell *matHeaderCellDef> Room </th>
                <td mat-cell *matCellDef="let b">{{ b.rooms?.name || b.rooms?.id || b.room_id || roomName(b) }}</td>
              </ng-container>

              <ng-container matColumnDef="user">
                <th mat-header-cell *matHeaderCellDef> User </th>
                <td mat-cell *matCellDef="let b">{{ b.username || '' }}</td>
              </ng-container>

              <ng-container matColumnDef="checkin">
                <th mat-header-cell *matHeaderCellDef> Check-in </th>
                <td mat-cell *matCellDef="let b">{{ b.checkin_date | date }}</td>
              </ng-container>

              <ng-container matColumnDef="checkout">
                <th mat-header-cell *matHeaderCellDef> Check-out </th>
                <td mat-cell *matCellDef="let b">{{ b.checkout_date | date }}</td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef> Status </th>
                <td mat-cell *matCellDef="let b">{{ b.status || '-' }}</td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          </div>
        </div>
      </div>
      </div>
    </mat-card>
  `
})
export class PortalBookingsComponent implements OnInit, OnDestroy {
  bookings$: Observable<any[] | null>;
  bookings: any[] | null = null;
  history: any[] | null = null;
  rooms: any[] | null = null;
  displayedColumns = ['bookingDate', 'room', 'user', 'checkin', 'checkout', 'status'];
  showHistory = false;
  loading = false;
  private _sub?: Subscription;
  private _roomMap: Record<string, any> = {} as any;
  private _pendingRooms: Record<string, Promise<any>> = {} as any;

  constructor(public svc: AdminService, private router: Router, private _snack: MatSnackBar) {
    this.bookings$ = this.svc.bookings$;
  }

  ngOnInit(): void {
    // Trigger fetches on init (like the users page) so the component shows
    // a loading state and data arrives quickly when navigated directly.
    this.svc.getBookings().catch((e) => console.warn('portal bookings prefetch failed', e));
    this.svc.getHistoryBookings().catch((e) => console.warn('portal history prefetch failed', e));
    this.svc.getRooms().catch((e) => console.warn('portal rooms prefetch failed', e));

    this._sub = this.svc.bookings$.subscribe((b: any[] | null | undefined) => { this.bookings = b || []; });
    // subscribe to history stream
    this._sub.add(this.svc.history$.subscribe((h: any[] | null | undefined) => {
      this.history = h || [];
      try {
        console.info('[portal-bookings] history rows', (this.history || []).length);
        if (this.history && this.history.length) console.debug('[portal-bookings] history sample', this.history[0]);
      } catch (_) {}
    }));
    // subscribe to rooms and build a quick lookup so we can show room names
    this._sub.add(this.svc.rooms$.subscribe((r: any[] | null | undefined) => {
      this.rooms = r || [];
      try {
        console.info('[portal-bookings] rooms loaded', (this.rooms || []).length);
        if (this.rooms && this.rooms.length) console.debug('[portal-bookings] rooms sample', this.rooms[0]);
        this._roomMap = {} as any;
        (this.rooms || []).forEach((rm: any) => {
          if (rm && rm.id != null) {
            const s = String(rm.id);
            this._roomMap[s] = rm;
            const n = Number(rm.id);
            if (!Number.isNaN(n)) this._roomMap[String(n)] = rm;
          }
        });
        // After rooms load, ensure history rows are enriched with room objects
        try { this.ensureHistoryRooms(); } catch (_) {}
      } catch (_) { this._roomMap = {}; }
    }));
    // Try to attach room objects to any history rows that lack them
    this._sub.add(this.svc.history$.subscribe(() => { this.ensureHistoryRooms(); }));
  }

  ngOnDestroy(): void {
    try { this._sub?.unsubscribe(); } catch {}
  }

  back() { history.back(); }

  get activeBookings() {
    const now = new Date();
    return (this.bookings || []).filter((b: any) => { try { return !b.checkout_date || new Date(b.checkout_date) > now; } catch { return true; } });
  }

  get historyBookings() {
    const now = new Date();
    return (this.history || []).filter((b: any) => {
      try {
        // Include bookings that have already checked out, or that were cancelled.
        if (b.status === 'cancelled') return true;
        return b.checkout_date && new Date(b.checkout_date) <= now;
      } catch {
        return false;
      }
    });
  }

  toggleHistory() { this.showHistory = !this.showHistory; }

  async processCheckouts() {
    try {
      const now = new Date().toISOString();
      // Select due bookings to determine affected room ids
      const { data: due, error: selErr } = await supabaseAdmin.from('bookings').select('id, room_id, checkout_date').lte('checkout_date', now);
      if (selErr) throw selErr;
      const roomIds = Array.from(new Set((due || []).map((r: any) => r.room_id).filter(Boolean)));
      // Archive due checkouts server-side (moves rows into history_bookings and deletes them from bookings)
      let movedCount: any = 0;
      try {
        const { data, error: rpcErr } = await supabaseAdmin.rpc('rpc_archive_due_checkouts');
        movedCount = data;
        if (rpcErr) throw rpcErr;
      } catch (rpcErr) {
        console.warn('rpc_archive_due_checkouts failed, falling back to client-side processing', rpcErr);
        // Fallback: mark due bookings as 'cancelled' and free their rooms (best-effort)
        try {
          const nowIso = new Date().toISOString();
          const { data: dueRows, error: selErr } = await supabaseAdmin.from('bookings').select('id, room_id').lte('checkout_date', nowIso);
          if (!selErr && dueRows && dueRows.length) {
            const roomIds = Array.from(new Set((dueRows as any[]).map(r => r.room_id).filter(Boolean)));
            // update bookings
            const { error: updErr } = await supabaseAdmin.from('bookings').update({ status: 'cancelled' }).in('id', (dueRows as any[]).map(r => r.id));
            if (updErr) console.warn('Fallback: update bookings to cancelled failed', updErr);
            if (roomIds.length) {
              const { error: upErr } = await supabaseAdmin.from('rooms').update({ status: 'available' }).in('id', roomIds);
              if (upErr) console.warn('Fallback: mark rooms available failed', upErr);
            }
          }
        } catch (fbErr) {
          console.warn('Fallback archive due checkouts failed', fbErr);
        }
      }
      if (roomIds.length) {
        const { error: upErr } = await supabaseAdmin.from('rooms').update({ status: 'available' }).in('id', roomIds);
        if (upErr) console.warn('room update after archive failed', upErr);
      }
      await this.svc.refreshRooms();
      await this.svc.refreshBookings();
      await this.svc.refreshHistoryBookings();
      const count = (movedCount as any) || 0;
      if (count) this._snack.open('Processed checkouts for ' + roomIds.length + ' rooms', 'Close', { duration: 4000 });
      else this._snack.open('No checkouts to process', 'Close', { duration: 3000 });
    } catch (e: any) {
      console.warn('processCheckouts failed', e);
      this._snack.open('Process checkouts failed: ' + (e.message || e), 'Close', { duration: 6000 });
    }
  }

  // Fast-refresh rooms, bookings and history in parallel (best-effort)
  async fastLoad() {
    if (this.loading) return;
    this.loading = true;
    try {
      this._snack.open('Refreshing data...', undefined, { duration: 1200 });
      await Promise.all([
        this.svc.refreshRooms().catch((e) => { console.warn('refreshRooms failed', e); throw e; }),
        this.svc.refreshBookings().catch((e) => { console.warn('refreshBookings failed', e); throw e; }),
        this.svc.refreshHistoryBookings().catch((e) => { console.warn('refreshHistoryBookings failed', e); throw e; }),
      ]);

      // If there are no active bookings but history rows exist, automatically show History
      try {
        const hasActive = (this.bookings && this.bookings.length > 0);
        const hasHistory = (this.history && this.history.length > 0);
        if (!hasActive && hasHistory) {
          this.showHistory = true;
        }
      } catch (e) { /* ignore */ }

      this._snack.open('Data refreshed', 'Close', { duration: 1500 });
    } catch (e: any) {
      console.warn('fastLoad failed', e);
      this._snack.open('Refresh failed: ' + (e?.message || e), 'Close', { duration: 6000 });
    } finally {
      this.loading = false;
    }
  }

  viewBooking(b: any) {
    try { this.router.navigate(['/admin-portal','bookings', b.id]); } catch (_) { alert(JSON.stringify(b)); }
  }

  // Return a human-friendly room name for a booking/history row
  roomName(b: any) {
    try {
      if (!b) return '';
      if (b.rooms && (b.rooms.name || b.rooms.id)) return b.rooms.name || b.rooms.id;
      // Prefer the explicit room_id, fallback to any embedded rooms.id
      const rawId = (b.room_id ?? (b.rooms && b.rooms.id));
      if (!rawId) return '';
      const key = String(rawId);
      const fromMap = this._roomMap[key];
      if (fromMap && (fromMap.name || fromMap.id)) return fromMap.name || fromMap.id;

      // Kick off a background fetch for this room id if we haven't already.
      if (key && key !== 'null' && key !== 'undefined' && !this._pendingRooms[key]) {
        this._pendingRooms[key] = (async () => {
          try {
            // Try string id first
            let { data, error } = await supabaseAdmin.from('rooms').select('id, name').eq('id', key).maybeSingle();
            if ((!data || !data.id) && !error) {
              // Try numeric id fallback
              const n = Number(key);
              if (!Number.isNaN(n)) {
                const r = await supabaseAdmin.from('rooms').select('id, name').eq('id', n).maybeSingle();
                data = (r as any).data;
                error = (r as any).error;
              }
            }

            if (!error && data) {
              const sid = String((data as any).id);
              this._roomMap[sid] = data;
              const nid = Number((data as any).id);
              if (!Number.isNaN(nid)) this._roomMap[String(nid)] = data;
              // keep rooms array in sync so other logic can use it
              try {
                this.rooms = this.rooms || [];
                if (!this.rooms.find(r => String(r.id) === sid)) this.rooms.push(data);
              } catch {}
            }
          } catch (_) { }
          try { delete this._pendingRooms[key]; } catch (_) {}
        })();
      }

      return b.room_id || '';
    } catch (_) { return b?.room_id || ''; }
  }

  // Ensure history rows have a `rooms` object where possible so templates can show the name.
  private async ensureHistoryRooms() {
    try {
      const rows = this.history || [];
      if (!rows.length) return;
      let changed = false;
      for (const r of rows) {
        try {
          if (r.rooms && Object.keys(r.rooms || {}).length) continue;
          const rawId = (r.room_id ?? (r.rooms && r.rooms.id));
          if (!rawId) continue;
          const key = String(rawId);
          // If we already have it in the map, attach it
          if (this._roomMap[key]) { r.rooms = this._roomMap[key]; continue; }

          // Try to fetch by string id first, then numeric fallback
          let found: any = null;
          try {
            const { data, error } = await supabaseAdmin.from('rooms').select('id, name').eq('id', key).maybeSingle();
            if (!error && data) found = data;
          } catch (_) {}
          if (!found) {
            const n = Number(key);
            if (!Number.isNaN(n)) {
              try {
                const { data, error } = await supabaseAdmin.from('rooms').select('id, name').eq('id', n).maybeSingle();
                if (!error && data) found = data;
              } catch (_) {}
            }
          }

            if (found) {
            const sid = String(found.id);
            this._roomMap[sid] = found;
            const nid = Number(found.id);
            if (!Number.isNaN(nid)) this._roomMap[String(nid)] = found;
            r.rooms = found;
            try {
              this.rooms = this.rooms || [];
              if (!this.rooms.find((x: any) => String(x.id) === sid)) this.rooms.push(found);
            } catch (_) {}
              changed = true;
          }
        } catch (_) { /* continue to next row */ }
      }
      if (changed) {
        try { this.history = Array.from(this.history || []); } catch (_) {}
      }
    } catch (_) {}
  }

  async deleteBooking(b: any) {
    const ok = confirm('Cancel booking for ' + (b.username || b.id) + '? This will remove the booking.');
    if (!ok) return;
    try {
      // Prefer RPC archival
      try {
        const { data, error } = await supabaseAdmin.rpc('rpc_archive_booking', { p_id: String(b.id), p_force_cancel: true });
        if (error) {
          // If PostgREST couldn't choose between overloaded functions, retry
          // with the explicit text-named RPC before falling back to update.
          if ((error as any)?.code === 'PGRST203') {
            try {
              // PostgREST sometimes can't resolve overloaded functions (PGRST203).
              // Call an unambiguous wrapper that forces cancelled status.
              const { data: altData, error: altErr } = await supabaseAdmin.rpc('rpc_archive_booking_text_force', { p_id: String(b.id) });
              if (altErr) throw altErr;
              try {
                const roomId = (altData && altData[0] && altData[0].room_id) || b.room_id;
                if (roomId) {
                  const { error: upErr } = await supabaseAdmin.from('rooms').update({ status: 'available' }).eq('id', roomId);
                  if (upErr) console.warn('room update after archive failed', upErr);
                }
              } catch (uErr) { console.warn('mark room available failed', uErr); }
            } catch (altErr) {
              console.warn('rpc_archive_booking_text failed, falling back to update:', altErr);
            }
          } else {
            throw error;
          }
        } else {
          try {
            const roomId = (data && data[0] && data[0].room_id) || b.room_id;
            if (roomId) {
              const { error: upErr } = await supabaseAdmin.from('rooms').update({ status: 'available' }).eq('id', roomId);
              if (upErr) console.warn('room update after archive failed', upErr);
            }
          } catch (uErr) { console.warn('mark room available failed', uErr); }
        }
      } catch (rpcErr) {
        console.warn('rpc_archive_booking failed, falling back to update:', rpcErr);
        // Fallback: mark booking as cancelled and free the room
        try {
          const { error: updErr } = await supabaseAdmin.from('bookings').update({ status: 'cancelled' }).eq('id', b.id);
          if (updErr) console.warn('Fallback: update booking status failed', updErr);
          const roomId = b.room_id;
          if (roomId) {
            const { error: upErr } = await supabaseAdmin.from('rooms').update({ status: 'available' }).eq('id', roomId);
            if (upErr) console.warn('Fallback: mark room available failed', upErr);
          }
        } catch (fbErr) {
          console.warn('Fallback deleteBooking failed', fbErr);
          throw fbErr;
        }
      }

      this._snack.open('Booking archived', 'Close', { duration: 3000 });
      await this.svc.refreshBookings();
      await this.svc.refreshRooms();
      await this.svc.refreshHistoryBookings();
    } catch (e: any) {
      console.warn('delete booking failed', e);
      this._snack.open('Cancel failed: ' + (e.message || e), 'Close', { duration: 5000 });
    }
  }
}

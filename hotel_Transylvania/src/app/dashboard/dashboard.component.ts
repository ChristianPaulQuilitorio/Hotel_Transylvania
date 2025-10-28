import { Component, ElementRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { getUser, supabase } from '../services/supabase.service';
import { getRooms as fetchRooms, seedRooms, bookRoom, cancelRoom, RoomDb, getRoomAmenities } from '../services/rooms.service';
import { createBooking, cancelBooking } from '../services/bookings.service';
import { RatingsService } from '../services/ratings.service';
import { WeatherService } from '../services/weather.service';

type Room = {
  id: number;
  name: string;
  image: string;
  short: string;
  description: string;
  capacity: number;
  status: 'available' | 'booked';
  bookedBy?: string | null;
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    .card.h-100 {
      border: 0;
      transition: transform .25s ease, box-shadow .25s ease;
    }
    .card.h-100:hover {
      transform: translateY(-6px) scale(1.02);
      box-shadow: 0 0.5rem 1.2rem rgba(0,0,0,.15) !important;
    }
    .card-img-top { transition: transform .35s ease; }
    .card.h-100:hover .card-img-top { transform: scale(1.03); }

    /* Greeting toast tweaks */
    .greet-toast { font-size: 1.05rem; }
    .greet-toast .toast-body { padding: 0.875rem 1rem; }
    @media (min-width: 576px) {
      .greet-toast { min-width: 360px; }
    }
  `],
  template: `
    <!-- Greeting Toast -->
    <div class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 1080">
      <div #greetToast class="toast align-items-center text-bg-dark border-0 greet-toast" role="alert" aria-live="polite" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body">
            {{ greetingMessage }}
          </div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
      </div>
    </div>

    <div class="container mt-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h3>Rooms</h3>
        <span class="text-muted d-none d-md-inline">&nbsp;</span>
      </div>

      <div class="row g-3">
        <div class="col-12 col-sm-6 col-lg-4" *ngFor="let room of rooms; let i = index">
          <div class="card h-100 shadow-sm">
            <img [src]="room.image" class="card-img-top" [alt]="room.name" style="object-fit:cover; height:160px;" />
            <div class="card-body d-flex flex-column">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <h5 class="card-title mb-0">{{ room.name }}</h5>
                <span class="badge" [class.bg-success]="room.status==='available'" [class.bg-secondary]="room.status==='booked'">
                  {{ room.status | titlecase }}
                </span>
              </div>
              <div class="mb-1 small text-warning" aria-label="Average rating">
                <ng-container *ngFor="let s of [1,2,3,4,5]; let i = index">
                  <span [class.opacity-50]="(ratings[room.id]?.average || 0) < s">★</span>
                </ng-container>
                <span class="text-muted ms-1" *ngIf="ratings[room.id] as r">({{ r.average | number:'1.1-1' }} / 5, {{ r.count }} ratings)</span>
              </div>
              <p class="text-muted small flex-grow-1">{{ room.short }}</p>
        <button class="btn btn-primary mt-auto" (click)="openRoom(room)"
          [attr.id]="i===0 ? 'tour-first-room-details' : null"
                      [attr.aria-label]="(room.status==='available' ? 'View details for ' : 'View booking for ') + room.name">
                {{ room.status==='available' ? 'View details' : 'View booking' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Room detail modal -->
      <div #roomModal class="modal fade" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">{{ selectedRoom?.name }}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" *ngIf="selectedRoom as r">
              <img [src]="r.image" [alt]="r.name" class="img-fluid rounded mb-3" />
              <p class="mb-2">{{ r.description }}</p>
              <p class="mb-0"><strong>Capacity:</strong> {{ r.capacity }} person{{ r.capacity>1 ? 's' : '' }}</p>
              <div class="mt-2">
                <strong>Amenities:</strong>
                <ul class="list-unstyled mb-0 mt-1 row row-cols-1 row-cols-sm-2 g-1">
                  <li class="col d-flex align-items-start" *ngFor="let a of getAmenities(r.id)">
                    <span class="material-icons me-1" style="font-size: 18px; line-height: 18px;">check_circle</span>
                    <span class="small">{{ a }}</span>
                  </li>
                </ul>
              </div>
              <div class="mt-2 small">
                <strong>Current rating:</strong>
                <span class="text-warning">
                  <ng-container *ngFor="let s of [1,2,3,4,5]">
                    <span [class.opacity-50]="(ratings[r.id]?.average || 0) < s">★</span>
                  </ng-container>
                </span>
                <span class="text-muted" *ngIf="ratings[r.id] as rr"> {{ rr.average | number:'1.1-1' }} / 5 ({{ rr.count }})</span>
              </div>

              <div class="mt-3 border rounded p-2 bg-light-subtle">
                <label class="form-label mb-1">Your rating</label>
                <div class="mb-2">
                  <button type="button" class="btn btn-sm" [class.text-warning]="userRating >= s" *ngFor="let s of [1,2,3,4,5]" (click)="userRating = s" [attr.aria-label]="'Rate ' + s + ' stars'">★</button>
                </div>
                <label class="form-label mt-1">Feedback (optional)</label>
                <textarea class="form-control" rows="2" [(ngModel)]="userComment" placeholder="Tell us what you liked or what to improve"></textarea>
                <div class="d-flex justify-content-end mt-2">
                  <button class="btn btn-outline-primary btn-sm" (click)="submitRating(r.id)" [disabled]="!userRating || !currentUserId">Submit rating</button>
                </div>
                <div class="text-danger small mt-1" *ngIf="ratingError">{{ ratingError }}</div>
                <div class="text-success small mt-1" *ngIf="ratingSuccess">Thanks for your feedback!</div>
              </div>
              <p *ngIf="r.status==='booked' && r.bookedBy && r.bookedBy !== currentUserId" class="text-danger mt-2 mb-0">
                This room is booked by another user.
              </p>

              <div class="mt-3" *ngIf="r.status==='available'">
                <div class="mb-2">
                  <label class="form-label">Check-in date</label>
                  <input class="form-control" type="date" [(ngModel)]="checkinDate" [min]="todayStr" />
                </div>
                <div class="mb-2">
                  <label class="form-label">Days (max 5)</label>
                  <select class="form-select" [(ngModel)]="stayDays">
                    <option *ngFor="let d of dayOptions" [value]="d">{{ d }}</option>
                  </select>
                </div>
                <div *ngIf="errorMessage" class="alert alert-danger py-2">{{ errorMessage }}</div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              <button *ngIf="selectedRoom?.status==='available'" class="btn btn-primary" (click)="availSelected()">Avail</button>
              <button *ngIf="selectedRoom?.status==='booked' && selectedRoom?.bookedBy === currentUserId" class="btn btn-danger" (click)="cancelSelected()">Cancel booking</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})

export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('roomModal', { static: true }) roomModalRef!: ElementRef<HTMLDivElement>;
  @ViewChild('greetToast', { static: true }) greetToastRef!: ElementRef<HTMLDivElement>;

  rooms: Room[] = [];

  selectedRoom: Room | null = null;
  private bsModal: any;
  currentUserId: string | null = null;
  // booking form state
  checkinDate: string = '';
  stayDays = 1;
  dayOptions = [1,2,3,4,5];
  todayStr = '';
  errorMessage: string | null = null;
  currentUsername: string | null = null;
  currentEmail: string | null = null;
  ratings: Record<number, { average: number; count: number }> = {};
  userRating = 0;
  userComment = '';
  ratingError: string | null = null;
  ratingSuccess = false;

  constructor(private router: Router, private weather: WeatherService, private ratingsSvc: RatingsService) {}
  private roomChannel: any;
  greetingMessage = '';

  async ngOnInit() {
    // Require logged-in user for booking actions
    try {
      const { data } = await getUser();
      const user = (data as any)?.user;
      this.currentUserId = user?.id ?? null;
      this.currentEmail = user?.email ?? null;
      if (!this.currentUserId) {
        // If not logged in, redirect to login
        this.router.navigate(['/login']);
      }
      // Try to fetch profile username
      if (this.currentUserId) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', this.currentUserId)
            .single();
          this.currentUsername = (profile as any)?.username ?? null;
        } catch {
          this.currentUsername = null;
        }

        // Show greeting toast with day/date/time and weather
        this.prepareGreetingToast();

        // Today string for date input min
        this.todayStr = new Date().toISOString().split('T')[0];
        // Load rooms from Supabase; if none, seed with defaults
  await this.loadRoomsFromDb();
  // Load ratings summary for each room
  this.loadRatings();

        // Subscribe to realtime changes so UI auto-updates when booking via AI/chat
        try {
          this.roomChannel = supabase
            .channel('rooms-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, (payload: any) => {
              const row = payload.new ?? payload.old;
              if (!row?.id) return;
              const idx = this.rooms.findIndex(r => r.id === row.id);
              if (idx >= 0 && payload.new) {
                this.rooms[idx] = this.mapDbToRoom(payload.new);
              } else if (idx === -1 && payload.new) {
                this.rooms.push(this.mapDbToRoom(payload.new));
              }
            })
            .subscribe();
        } catch {}
      }
    } catch {
      this.currentUserId = null;
      this.router.navigate(['/login']);
    }
  }

  ngOnDestroy(): void {
    try { this.roomChannel && supabase.removeChannel(this.roomChannel); } catch {}
  }

  // Logout moved to the global navbar

  openRoom(room: Room) {
    this.selectedRoom = room;
    // reset booking form
    this.checkinDate = '';
    this.stayDays = 1;
    this.errorMessage = null;
    const el = this.roomModalRef.nativeElement;
    this.bsModal = new (window as any).bootstrap.Modal(el);
    this.bsModal.show();
  }

  async availSelected() {
    if (!this.selectedRoom) return;
    if (!this.currentUserId) {
      this.router.navigate(['/login']);
      return;
    }
    // validate booking inputs
    this.errorMessage = null;
    if (!this.checkinDate) {
      this.errorMessage = 'Please choose a check-in date.';
      return;
    }
    if (this.stayDays < 1 || this.stayDays > 5) {
      this.errorMessage = 'Stay must be between 1 and 5 days.';
      return;
    }
    // compute checkout date
    const start = new Date(this.checkinDate + 'T00:00:00');
    const checkout = new Date(start);
    checkout.setDate(start.getDate() + this.stayDays);
    const checkoutStr = checkout.toISOString().split('T')[0];
    // Try to create a booking record, but don't block room reservation if it fails (RLS/FK)
    try {
      await createBooking(this.selectedRoom.id, this.currentUserId, this.checkinDate, checkoutStr);
    } catch {}
    try {
      // Mark room as booked (authoritative)
      const ok = await bookRoom(this.selectedRoom.id, this.currentUserId);
      if (ok) {
        this.selectedRoom.status = 'booked';
        this.selectedRoom.bookedBy = this.currentUserId;
      } else {
        this.errorMessage = 'Room is not available for the selected date.';
        return;
      }
    } catch (e) {
      this.errorMessage = 'Could not reserve the room. Please try again later.';
      return;
    }
    this.bsModal?.hide();
  }

  async cancelSelected() {
    if (!this.selectedRoom) return;
    // Only the user who booked can cancel
    const bookedBy = this.selectedRoom.bookedBy ?? undefined;
    if (bookedBy && bookedBy !== this.currentUserId) {
      // not allowed; just close modal
      this.bsModal?.hide();
      return;
    }
    // try to cancel booking record but don't block room cancel on error (policies may not exist yet)
    if (this.currentUserId) {
      cancelBooking(this.selectedRoom.id, this.currentUserId).catch(() => {});
    }
    try {
      const ok = await cancelRoom(this.selectedRoom.id, this.currentUserId as string);
      if (ok) {
        this.selectedRoom.status = 'available';
        this.selectedRoom.bookedBy = null;
      }
    } catch (e) {
      // leave status as-is if backend denies
    }
    this.bsModal?.hide();
  }

  private async loadRoomsFromDb() {
    try {
      const data = await fetchRooms();
      if (data && data.length > 0) {
        this.rooms = data.map(this.mapDbToRoom);
        return;
      }

      // No data found -> attempt to seed, but always fall back to local defaults for UI
      const defaults: RoomDb[] = [
        { id: 1, name: 'Deluxe King', image: 'assets/rooms/bed1.jpg', description: 'A spacious deluxe room with a comfortable king-sized bed, modern amenities, and a city view.', short: 'Spacious room with king bed', capacity: 2, status: 'available', booked_by: null },
        { id: 2, name: 'Twin Suite', image: 'assets/rooms/bed2.jpg', description: 'A cozy suite featuring two twin beds, perfect for friends or colleagues traveling together.', short: 'Two beds perfect for friends', capacity: 2, status: 'available', booked_by: null },
        { id: 3, name: 'Family Room', image: 'assets/rooms/bed3.jpg', description: 'An ideal room for families with additional space and extra bedding available upon request.', short: 'Ideal for families', capacity: 4, status: 'available', booked_by: null },
        { id: 4, name: 'Queen Standard', image: 'assets/rooms/bed4.jpg', description: 'A comfortable queen room with all essentials for a pleasant stay at a great rate.', short: 'Comfortable and affordable', capacity: 2, status: 'available', booked_by: null },
        { id: 5, name: 'Executive Suite', image: 'assets/rooms/bed5.jpg', description: 'Premium suite with a separate living area, workspace, and luxury amenities.', short: 'Premium experience', capacity: 3, status: 'available', booked_by: null },
      ];
      try {
        await seedRooms(defaults);
      } catch {}
      this.rooms = defaults.map(this.mapDbToRoom);
    } catch (e) {
      // Any DB error -> show local defaults so UI is never empty
      this.rooms = this.getDefaultRooms();
    }
  }

  private mapDbToRoom = (r: RoomDb): Room => ({
    id: r.id,
    name: r.name,
    image: r.image,
    short: r.short ?? '',
    description: r.description,
    capacity: r.capacity,
    status: r.status,
    bookedBy: r.booked_by,
  });

  private getDefaultRooms(): Room[] {
    return [
      { id: 1, name: 'Deluxe King', image: 'assets/rooms/bed1.jpg', short: 'Spacious room with king bed', description: 'A spacious deluxe room with a comfortable king-sized bed, modern amenities, and a city view.', capacity: 2, status: 'available', bookedBy: null },
      { id: 2, name: 'Twin Suite', image: 'assets/rooms/bed2.jpg', short: 'Two beds perfect for friends', description: 'A cozy suite featuring two twin beds, perfect for friends or colleagues traveling together.', capacity: 2, status: 'available', bookedBy: null },
      { id: 3, name: 'Family Room', image: 'assets/rooms/bed3.jpg', short: 'Ideal for families', description: 'An ideal room for families with additional space and extra bedding available upon request.', capacity: 4, status: 'available', bookedBy: null },
      { id: 4, name: 'Queen Standard', image: 'assets/rooms/bed4.jpg', short: 'Comfortable and affordable', description: 'A comfortable queen room with all essentials for a pleasant stay at a great rate.', capacity: 2, status: 'available', bookedBy: null },
      { id: 5, name: 'Executive Suite', image: 'assets/rooms/bed5.jpg', short: 'Premium experience', description: 'Premium suite with a separate living area, workspace, and luxury amenities.', capacity: 3, status: 'available', bookedBy: null },
    ];
  }

  getAmenities(id: number): string[] {
    return getRoomAmenities(id);
  }

  private async loadRatings() {
    try {
      for (const r of this.rooms) {
        const sum = await this.ratingsSvc.getSummary(r.id);
        this.ratings[r.id] = sum;
      }
    } catch {}
  }

  async submitRating(roomId: number) {
    this.ratingError = null;
    this.ratingSuccess = false;
    if (!this.currentUserId) { this.ratingError = 'Please login to submit a rating.'; return; }
    if (!this.userRating) { this.ratingError = 'Please choose a star rating.'; return; }
    try {
      await this.ratingsSvc.submit(roomId, this.currentUserId, this.userRating, this.userComment?.trim() || undefined);
      // Refresh summary and reset feedback flag
      this.ratings[roomId] = await this.ratingsSvc.getSummary(roomId);
      this.ratingSuccess = true;
      // Optionally reset comment
      // this.userComment = '';
    } catch {
      this.ratingError = 'Could not submit your rating right now.';
    }
  }

  private async prepareGreetingToast() {
    try {
      const now = new Date();
      const hour = now.getHours();
      const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
      const dt = new Intl.DateTimeFormat(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(now);
      const wx = await this.weather.getCurrent();
      const who = this.currentUsername || this.currentEmail || 'there';
      const weatherStr = wx && wx.temperatureC != null
        ? `${Math.round(wx.temperatureC)}°C, ${wx.description || 'Weather'}`
        : 'weather unavailable';
      this.greetingMessage = `${part}, ${who}. Today is ${dt}. Current weather: ${weatherStr}.`;
      setTimeout(() => {
        try {
          const el = this.greetToastRef?.nativeElement;
          if (!el) return;
          const toast = new (window as any).bootstrap.Toast(el, { delay: 5000 });
          toast.show();
        } catch {}
      }, 300);
    } catch {}
  }
}

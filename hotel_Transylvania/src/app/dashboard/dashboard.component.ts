import { Component, ElementRef, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { getUser, supabase } from '../services/supabase.service';
import { getRooms as fetchRooms, seedRooms, bookRoom, cancelRoom, RoomDb } from '../services/rooms.service';
import { createBooking, cancelBooking } from '../services/bookings.service';

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
  template: `
    <div class="container mt-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h3>Rooms</h3>
        <span class="text-muted d-none d-md-inline">&nbsp;</span>
      </div>

      <div class="row g-3">
        <div class="col-12 col-sm-6 col-lg-4" *ngFor="let room of rooms">
          <div class="card h-100 shadow-sm">
            <img [src]="room.image" class="card-img-top" [alt]="room.name" style="object-fit:cover; height:160px;" />
            <div class="card-body d-flex flex-column">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <h5 class="card-title mb-0">{{ room.name }}</h5>
                <span class="badge" [class.bg-success]="room.status==='available'" [class.bg-secondary]="room.status==='booked'">
                  {{ room.status | titlecase }}
                </span>
              </div>
              <p class="text-muted small flex-grow-1">{{ room.short }}</p>
              <button class="btn btn-primary mt-auto" (click)="openRoom(room)">
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

export class DashboardComponent implements OnInit {
  @ViewChild('roomModal', { static: true }) roomModalRef!: ElementRef<HTMLDivElement>;

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

  constructor(private router: Router) {}

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

        // Today string for date input min
        this.todayStr = new Date().toISOString().split('T')[0];
        // Load rooms from Supabase; if none, seed with defaults
        await this.loadRoomsFromDb();
      }
    } catch {
      this.currentUserId = null;
      this.router.navigate(['/login']);
    }
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
}

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatbotService, ChatMsg } from '../services/chatbot.service';
import { createBooking } from '../services/bookings.service';
import { bookRoom } from '../services/rooms.service';
import { supabase } from '../services/supabase.service';

@Component({
  standalone: true,
  selector: 'app-chatbot',
  imports: [CommonModule, FormsModule],
  template: `
  <button class="btn btn-primary position-fixed" style="right:20px; bottom:20px; z-index:1050"
          data-bs-toggle="offcanvas" data-bs-target="#aiChatCanvas">Chat</button>

  <div class="offcanvas offcanvas-end" tabindex="-1" id="aiChatCanvas" style="width:360px">
    <div class="offcanvas-header">
      <h5 class="offcanvas-title">Drac</h5>
      <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
    </div>
    <div class="offcanvas-body d-flex flex-column">
      <div class="flex-grow-1 overflow-auto border rounded p-2 mb-2" style="background:#fafafa; max-height:60vh">
        <div *ngFor="let m of messages" class="mb-2">
          <div [class.text-end]="m.role==='user'">
            <span class="badge bg-secondary me-2" *ngIf="m.role!=='user'">Drac</span>
            <span class="badge bg-primary me-2" *ngIf="m.role==='user'">You</span>
            <span>{{ m.content }}</span>
          </div>
        </div>
        <div *ngIf="loading" class="text-muted">Drac is typing…</div>

        <!-- Pending booking confirmation UI -->
        <div *ngIf="pendingBooking" class="alert alert-info mt-2">
          <div>
            Drac can book Room {{pendingBooking.roomId}} from {{pendingBooking.checkin}} for {{pendingBooking.days}} day(s)
            (checkout {{pendingBooking.checkout}}).
          </div>
          <div class="mt-2 d-flex gap-2">
            <button class="btn btn-success btn-sm" (click)="confirmBooking()" [disabled]="bookingBusy">Confirm booking</button>
            <button class="btn btn-outline-secondary btn-sm" (click)="cancelPendingBooking()" [disabled]="bookingBusy">Cancel</button>
          </div>
          <div *ngIf="bookingBusy" class="small text-muted mt-1">Processing…</div>
        </div>
      </div>

      <!-- Quick suggestions for one-click prompts -->
      <div class="mb-2 d-flex flex-wrap gap-2">
        <button class="btn btn-outline-secondary btn-sm" (click)="quickAsk('How do I book a room?')">How do I book a room?</button>
        <button class="btn btn-outline-secondary btn-sm" (click)="quickAsk('How do I log in?')">How do I log in?</button>
        <button class="btn btn-outline-secondary btn-sm" (click)="quickAsk('Available rooms today')">Available rooms today</button>
        <button class="btn btn-outline-secondary btn-sm" (click)="quickAsk('Is room 2 available tomorrow?')">Is room 2 available tomorrow?</button>
        <button class="btn btn-outline-secondary btn-sm" (click)="quickAsk('Book room 2 tomorrow for 2 days')">Book room 2 tomorrow for 2 days</button>
      </div>

      <form (ngSubmit)="send()" class="d-flex gap-2">
        <input class="form-control" [(ngModel)]="input" name="input" placeholder="Type a message..." />
        <button class="btn btn-primary" [disabled]="!input || loading">Send</button>
      </form>
      <small class="text-muted mt-2">Don’t share secrets. Messages may be sent to an AI service.</small>
    </div>
  </div>
  `,
})
export class ChatbotComponent {
  messages: ChatMsg[] = [];
  input = '';
  loading = false;
  pendingBooking: { roomId: number; checkin: string; days: number; checkout: string } | null = null;
  bookingBusy = false;
  private requestSerial = 0; // used to ignore late AI responses

  constructor(private chat: ChatbotService) {}

  async send() {
    const text = this.input.trim();
    if (!text) return;
    this.messages.push({ role: 'user', content: text });
    this.input = '';

    // If user message looks like a booking command, prepare a confirmation
    const plan = this.tryParseBooking(text);
    if (plan) {
      this.pendingBooking = plan;
      this.messages.push({ role: 'assistant', content: `Got it. I can book Room ${plan.roomId} from ${plan.checkin} for ${plan.days} day(s) (checkout ${plan.checkout}). Please confirm below.` });
      // Invalidate any in-flight AI response to avoid stray fallbacks
      this.requestSerial++;
      this.loading = false;
      // Auto-confirm booking for convenience (if not logged in, user will see a prompt and the card stays)
      void this.confirmBooking();
      return; // skip AI call for this message
    }

    this.loading = true;
    const mySerial = ++this.requestSerial;
    try {
      const history = this.messages.slice(-12);
      const reply = await this.chat.send(history);
      if (this.requestSerial === mySerial) {
        this.messages.push({ role: 'assistant', content: reply });
      }
    } catch {
      if (this.requestSerial === mySerial) {
        this.messages.push({ role: 'assistant', content: 'AI can’t solve that, please contact our key personnel.' });
      }
    } finally {
      if (this.requestSerial === mySerial) {
        this.loading = false;
      }
    }
  }

  quickAsk(text: string) {
    this.input = text;
    void this.send();
  }

  cancelPendingBooking() { this.pendingBooking = null; }

  private pad(n: number) { return String(n).padStart(2, '0'); }
  private toISO(d: Date) { return `${d.getFullYear()}-${this.pad(d.getMonth()+1)}-${this.pad(d.getDate())}`; }
  private parseDateToken(q: string): string | null {
    const today = new Date();
    const lc = q.toLowerCase();
    if (lc.includes('today')) return this.toISO(today);
    if (lc.includes('tomorrow')) { const t = new Date(today); t.setDate(t.getDate()+1); return this.toISO(t); }
    const m = lc.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
    if (m) {
      const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
      if (y > 1900 && mo>=1 && mo<=12 && d>=1 && d<=31) return `${y}-${this.pad(mo)}-${this.pad(d)}`;
    }
    return null;
  }

  private tryParseBooking(q: string): { roomId: number; checkin: string; days: number; checkout: string } | null {
    const rm = q.toLowerCase().match(/book\s+room\s+(\d+)/);
    if (!rm) return null;
    const roomId = Number(rm[1]);
    const date = this.parseDateToken(q) || this.toISO(new Date());
    const dm = q.toLowerCase().match(/(\d+)\s*day/);
    const days = dm ? Math.min(5, Math.max(1, Number(dm[1]))) : 1;
    const checkin = date;
    const d = new Date(checkin); d.setDate(d.getDate() + days); const checkout = this.toISO(d);
    return { roomId, checkin, days, checkout };
  }

  async confirmBooking() {
    if (!this.pendingBooking) return;
    this.bookingBusy = true;
    try {
      const { data } = await supabase.auth.getUser();
      const userId: string | null = (data as any)?.user?.id ?? null;
      if (!userId) {
        this.messages.push({ role: 'assistant', content: 'Please log in to complete the booking.' });
        return;
      }

      const plan = this.pendingBooking;
      // Try to create booking record (may fail due to RLS/FK); do not abort on failure
      let bookingRecordCreated = true;
      try {
        await createBooking(plan.roomId, userId, plan.checkin, plan.checkout);
      } catch (e) {
        bookingRecordCreated = false;
      }

      // Then attempt to mark the room as booked (authoritative)
      const ok = await bookRoom(plan.roomId, userId);
      if (!ok) {
        this.messages.push({ role: 'assistant', content: `Sorry, Room ${plan.roomId} is not available for ${plan.checkin}.` });
        return;
      }
      const extra = bookingRecordCreated ? '' : ' (note: booking receipt could not be saved, but your room is reserved)';
      this.messages.push({ role: 'assistant', content: `Booking confirmed! Room ${plan.roomId} from ${plan.checkin} to ${plan.checkout}.${extra}` });
      this.pendingBooking = null;
    } catch (e) {
      console.error(e);
      this.messages.push({ role: 'assistant', content: 'Sorry, something went wrong while booking. Please try again or use the Dashboard.' });
    } finally {
      this.bookingBusy = false;
    }
  }
}

import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatbotService, ChatMsg } from '../services/chatbot.service';
import { SettingsService } from '../services/settings.service';
import { createBooking } from '../services/bookings.service';
import { bookRoom } from '../services/rooms.service';
import { supabase } from '../services/supabase.service';

@Component({
  standalone: true,
  selector: 'app-chatbot',
  imports: [CommonModule, FormsModule],
  template: `
  <button class="btn btn-primary position-fixed chat-fab" [ngStyle]="chatFabStyle" style="z-index:1050"
          data-bs-toggle="offcanvas" data-bs-target="#aiChatCanvas" (click)="openChat()" [hidden]="isChatOpen"
          aria-controls="aiChatCanvas" aria-label="Open chat with Drac">Chat</button>

  <div #chatCanvas class="offcanvas offcanvas-end" tabindex="-1" id="aiChatCanvas" style="width:380px" role="dialog" aria-modal="false" aria-labelledby="aiChatTitle">
    <div class="offcanvas-header align-items-start">
      <div class="me-2">
        <h5 class="offcanvas-title mb-1" id="aiChatTitle">Drac Assistant</h5>
        <div class="d-flex align-items-center gap-2 small text-muted">
          <span class="rounded-circle bg-success d-inline-block" style="width:8px;height:8px"></span>
          <span>Online</span>
        </div>
      </div>
      <div class="d-flex align-items-center gap-2 ms-auto">
        <button class="btn btn-sm btn-link text-secondary" type="button" (click)="clearChat()" aria-label="Clear conversation">Clear</button>
        <button type="button" class="btn-close" data-bs-dismiss="offcanvas" (click)="closeChat()" aria-label="Close chat"></button>
      </div>
    </div>
    <div class="offcanvas-body d-flex flex-column">
      <!-- Messages area -->
  <div #msgWrap class="flex-grow-1 overflow-auto border rounded p-2 mb-2 chat-messages" style="background:#fafafa; max-height:60vh" role="log" aria-live="polite">
        <ng-container *ngFor="let m of messages; let i = index">
          <div class="d-flex mb-2" [class.justify-content-end]="m.role==='user'">
            <div class="d-flex align-items-start" [class.flex-row-reverse]="m.role==='user'" style="max-width:85%">
              <!-- Avatar -->
              <div class="me-2 ms-2" aria-hidden="true">
                <div class="rounded-circle d-inline-flex align-items-center justify-content-center" [ngClass]="m.role==='user' ? 'bg-primary text-white' : 'bg-secondary text-white'" style="width:28px;height:28px;font-size:12px;">{{ m.role==='user' ? 'You' : 'D' }}</div>
              </div>
              <!-- Bubble -->
              <div class="p-2 rounded-3 shadow-sm chat-bubble" [ngClass]="m.role==='user' ? 'user bg-primary text-white' : 'assistant bg-white'">
                <div style="white-space: pre-wrap;">{{ m.content }}</div>
                <div class="mt-1 small opacity-75" [class.text-end]="m.role==='user'">{{ m.time }}</div>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- Typing indicator -->
        <div *ngIf="loading" class="d-flex align-items-center gap-2 text-muted">
          <div class="rounded-circle bg-secondary" style="width:8px;height:8px"></div>
          <div>Drac is typing…</div>
        </div>

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

      <!-- Quick suggestions: compact chips -->
      <div class="mb-2 d-flex flex-wrap gap-2">
        <span class="small text-muted w-100">Quick actions</span>
        <button class="btn btn-outline-secondary btn-sm rounded-pill" (click)="quickAsk('What rooms do you have? What amenities are included?')">Rooms & amenities</button>
        <button class="btn btn-outline-secondary btn-sm rounded-pill" (click)="quickAsk('Available rooms today')">Available today</button>
        <button class="btn btn-outline-secondary btn-sm rounded-pill" (click)="quickAsk('Is room 2 available tomorrow?')">Check room 2 tomorrow</button>
        <button class="btn btn-outline-secondary btn-sm rounded-pill" (click)="quickAsk('Book room 2 tomorrow for 2 days')">Book room 2</button>
        <button class="btn btn-outline-secondary btn-sm rounded-pill" (click)="quickAsk('How do I book a room?')">How to book</button>
        <button class="btn btn-outline-secondary btn-sm rounded-pill" (click)="quickAsk('How do I log in?')">Login / Signup</button>
      </div>

      <!-- Input -->
      <form (ngSubmit)="send()" class="d-flex gap-2">
        <input #chatInput class="form-control" [(ngModel)]="input" name="input" placeholder="Type a message..." autocomplete="off" />
        <button class="btn btn-primary" [disabled]="!input || loading" aria-label="Send message">Send</button>
      </form>
      <small class="text-muted mt-2">Don’t share secrets. Messages may be sent to an AI service.</small>
    </div>
  </div>
  `,
})
export class ChatbotComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chatCanvas', { static: true }) chatCanvasRef!: ElementRef<HTMLDivElement>;
  @ViewChild('chatInput') chatInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('msgWrap') msgWrapRef!: ElementRef<HTMLDivElement>;

  // UI message with timestamp for nicer rendering
  messages: ({ role: 'user'|'assistant'; content: string; time: string })[] = [];
  input = '';
  loading = false;
  pendingBooking: { roomId: number; checkin: string; days: number; checkout: string } | null = null;
  bookingBusy = false;
  private requestSerial = 0; // used to ignore late AI responses
  isChatOpen = false;
  private offcanvasShownHandler?: () => void;
  private offcanvasHiddenHandler?: () => void;

  constructor(private chat: ChatbotService, private settings: SettingsService) {}

  ngAfterViewInit(): void {
    const el = this.chatCanvasRef?.nativeElement;
    if (!el) return;
    const onShown = () => { this.isChatOpen = true; };
    const onHidden = () => { this.isChatOpen = false; };
    this.offcanvasShownHandler = onShown;
    this.offcanvasHiddenHandler = onHidden;
    el.addEventListener('shown.bs.offcanvas', onShown);
    el.addEventListener('hidden.bs.offcanvas', onHidden);

    // global '/' shortcut to focus chat
    const onKeydown = (e: KeyboardEvent) => {
      if (!this.settings.get().enableChatShortcut) return;
      const isSlash = e.key === '/' || e.code === 'Slash';
      if (isSlash && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
        if (isTyping) return; // don't steal focus from inputs
        e.preventDefault();
        // open offcanvas if needed
        try {
          const bootstrapAny = (window as any).bootstrap;
          if (bootstrapAny?.Offcanvas) {
            const off = bootstrapAny.Offcanvas.getOrCreateInstance(el);
            off.show();
          } else if (bootstrapAny) {
            // fallback older API
            const off = new bootstrapAny.Offcanvas(el);
            off.show();
          } else {
            // final fallback: toggle attribute to make it visible (best-effort)
            el.classList.add('show');
            el.style.visibility = 'visible';
          }
          setTimeout(() => this.chatInputRef?.nativeElement?.focus(), 150);
        } catch {}
      }
    };
    document.addEventListener('keydown', onKeydown, { passive: false });
    this.offcanvasHiddenHandler = ((this.offcanvasHiddenHandler as any) || (() => {}));
    // store keydown handler for cleanup
    (this as any)._chatKeyHandler = onKeydown;

    // Load any saved conversation
    try {
      const raw = localStorage.getItem('chat_history');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) this.messages = parsed.filter((m: any) => m && m.role && m.content && m.time);
        setTimeout(() => this.scrollToBottom(), 0);
      }
    } catch {}
  }

  ngOnDestroy(): void {
    try {
      const el = this.chatCanvasRef?.nativeElement;
      if (el) {
        if (this.offcanvasShownHandler) el.removeEventListener('shown.bs.offcanvas', this.offcanvasShownHandler);
        if (this.offcanvasHiddenHandler) el.removeEventListener('hidden.bs.offcanvas', this.offcanvasHiddenHandler);
      }
      const h = (this as any)._chatKeyHandler;
      if (h) document.removeEventListener('keydown', h as any);
    } catch {}
  }

  openChat() { this.isChatOpen = true; }
  closeChat() { this.isChatOpen = false; }

  get chatFabStyle() {
    const side = this.settings.get().chatFabSide;
    return side === 'left' ? { left: '20px', bottom: '20px' } : { right: '20px', bottom: '20px' };
  }

  async send() {
    const text = this.input.trim();
    if (!text) return;
    this.messages.push({ role: 'user', content: text, time: this.nowTime() });
    this.persist();
    this.scrollToBottomSoon();
    this.input = '';

    // If user message looks like a booking command, validate required details and prepare a confirmation
    const detectedIntent = /book\s+room\s+\d+/i.test(text);
    const plan = this.tryParseBooking(text);
    if (detectedIntent && !plan) {
      // Missing date or days
      this.messages.push({
        role: 'assistant',
        content: 'To book a room, please include: check-in date (YYYY-MM-DD or “today/\'tomorrow\'”) and number of days (1–5).\nExample: Book room 2 on 2025-11-03 for 2 days.',
        time: this.nowTime()
      });
      this.persist();
      this.scrollToBottomSoon();
      // avoid AI call
      this.requestSerial++;
      this.loading = false;
      return;
    }
    if (plan) {
      this.pendingBooking = plan;
      this.messages.push({ role: 'assistant', content: `Got it. I can book Room ${plan.roomId} from ${plan.checkin} for ${plan.days} day(s) (checkout ${plan.checkout}). Please confirm below.`, time: this.nowTime() });
      this.persist();
      this.scrollToBottomSoon();
      // Invalidate any in-flight AI response to avoid stray fallbacks
      this.requestSerial++;
      this.loading = false;
      // Require explicit confirmation (do NOT auto-confirm)
      return; // skip AI call for this message
    }

    this.loading = true;
    const mySerial = ++this.requestSerial;
    try {
      const history: ChatMsg[] = this.messages.slice(-12).map(m => ({ role: m.role as ChatMsg['role'], content: m.content }));
      const reply = await this.chat.send(history);
      if (this.requestSerial === mySerial) {
        this.messages.push({ role: 'assistant', content: reply, time: this.nowTime() });
        this.persist();
        this.scrollToBottomSoon();
      }
    } catch {
      if (this.requestSerial === mySerial) {
        this.messages.push({ role: 'assistant', content: 'AI can’t solve that, please contact our key personnel.', time: this.nowTime() });
        this.persist();
        this.scrollToBottomSoon();
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
    const date = this.parseDateToken(q); // require user to specify
    const dm = q.toLowerCase().match(/(\d+)\s*day/);
    if (!date || !dm) return null; // missing required info
    const days = Math.min(5, Math.max(1, Number(dm[1])));
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
        this.messages.push({ role: 'assistant', content: 'Please log in to complete the booking.', time: this.nowTime() });
        this.persist();
        this.scrollToBottomSoon();
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
        this.messages.push({ role: 'assistant', content: `Sorry, Room ${plan.roomId} is not available for ${plan.checkin}.`, time: this.nowTime() });
        this.persist();
        this.scrollToBottomSoon();
        return;
      }
      const extra = bookingRecordCreated ? '' : ' (note: booking receipt could not be saved, but your room is reserved)';
      this.messages.push({ role: 'assistant', content: `Booking confirmed! Room ${plan.roomId} from ${plan.checkin} to ${plan.checkout}.${extra}`, time: this.nowTime() });
      this.persist();
      this.scrollToBottomSoon();
      // Optional: notify the dashboard via Supabase Realtime will auto-refresh; no further action needed here
      this.pendingBooking = null;
    } catch (e) {
      console.error(e);
      this.messages.push({ role: 'assistant', content: 'Sorry, something went wrong while booking. Please try again or use the Dashboard.', time: this.nowTime() });
      this.persist();
      this.scrollToBottomSoon();
    } finally {
      this.bookingBusy = false;
    }
  }

  clearChat() {
    this.messages = [];
    this.pendingBooking = null;
    this.persist();
  }

  private nowTime(): string {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  private scrollToBottom() {
    try {
      const el = this.msgWrapRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }
  private scrollToBottomSoon() { setTimeout(() => this.scrollToBottom(), 0); }

  private persist() {
    try { localStorage.setItem('chat_history', JSON.stringify(this.messages)); } catch {}
  }
}

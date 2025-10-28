import { Injectable } from '@angular/core';
import { supabase } from './supabase.service';
import { getRooms, getRoomAmenities, ROOM_AMENITIES } from './rooms.service';
import { getBookedRoomIdsOnDate, isRoomBookedOnDate, isRoomAvailableRPC, availableRoomsOnRPC } from './bookings.service';

export type ChatRole = 'system' | 'user' | 'assistant';
export type ChatMsg = { role: ChatRole; content: string };

// Small, app-specific system prompt. If the AI is unsure or outside scope, it must defer.
const APP_SUMMARY = `
You are BookSmart's hotel assistant for the Hotel Transylvania Angular app. Your name is Drac.
Capabilities:
- Explain app pages: Landing, Login/Signup (Supabase auth), Dashboard with Rooms grid and availability.
- Describe room booking flow: pick a room, select check-in date and days (1-5), then Avail to book. Owners can Cancel their own bookings.
- Data: Rooms and bookings stored in Supabase with RLS; images from /assets/rooms; usernames from profiles.
Constraints:
- If the user asks about topics outside this app or you are not confident you can answer correctly, respond exactly with: "AI can’t solve that, please contact our key personnel."
`; 

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private systemMessage: ChatMsg = { role: 'system', content: APP_SUMMARY };
  private faqLoaded = false;
  private faqIntents: { id: string; patterns: string[]; answer: string }[] = [];

  // Sends the conversation to Supabase Edge Function 'chatbot'.
  async send(userMessages: ChatMsg[]): Promise<string> {
    // 1) Try local, deterministic answers first (fast and reliable)
  const lastUser = [...userMessages].reverse().find(m => m.role === 'user');
  const local = lastUser ? await this.answerLocally(lastUser.content) : null;
    if (local) return local;

    // 2) Otherwise, call the Edge Function (server-side AI)
    const messages: ChatMsg[] = [this.systemMessage, ...userMessages];
    try {
      const { data, error } = await supabase.functions.invoke('chatbot', {
        body: { messages },
      });
      if (error) throw error;
      const reply: string | undefined = data?.reply?.content;
      return reply ?? 'AI can’t solve that, please contact our key personnel.';
    } catch (e) {
      return 'AI can’t solve that, please contact our key personnel.';
    }
  }

  // Simple app-specific FAQ answers without hitting AI
  private async loadFaq(): Promise<void> {
    if (this.faqLoaded) return;
    try {
      const res = await fetch('/faq.json');
      if (res.ok) {
        const json = await res.json();
        this.faqIntents = Array.isArray(json?.intents) ? json.intents : [];
      }
    } catch {
      // ignore fetch errors; fallback to built-ins
    } finally {
      this.faqLoaded = true;
    }
  }

  private async answerLocally(text: string): Promise<string | null> {
    const q = text.toLowerCase().trim();

    // -1) Quick greeting intent
    if (/^(hi|hello|hey|yo|good\s*(morning|afternoon|evening)|greetings|sup|what'?s up|whats up|hola)\b/.test(q)) {
      const ans = "Hello! I'm Drac. How can I help with bookings or availability today?";
      await this.logChat(text, ans, false, 'greeting');
      return ans;
    }

    // 0) Availability questions (dynamic)
    const availability = await this.tryAvailability(q);
    if (availability) return availability;

    // 1) JSON FAQ (editable without code)
    await this.loadFaq();
    for (const intent of this.faqIntents) {
      if (intent.patterns?.some(p => q.includes(p.toLowerCase()))) {
        await this.logChat(text, intent.answer, false, intent.id);
        return intent.answer;
      }
    }

    // Booking flow
    if (/(how\s+do\s+i\s+book|book\s+a\s+room|booking\s+room)/.test(q)) {
      const ans = [
        'To book a room:',
        '1) Log in (Login on the top-right).',
        '2) Go to the Dashboard and click a room.',
        '3) Pick a check-in date and choose 1–5 days.',
        '4) Click Avail to confirm. The room turns Booked and only you can Cancel it.',
      ].join('\n');
      await this.logChat(text, ans, false, 'booking_help');
      return ans;
    }

    // Login / Signup
    if (/(how\s+do\s+i\s+log\s*in|login|log\s+in|sign\s*up|create\s+account)/.test(q)) {
      const ans = [
        'Login/Signup:',
        '• Use the Login or Sign up buttons on the toolbar.',
      ].join('\n');
      await this.logChat(text, ans, false, 'login_help');
      return ans;
    }

    // Cancel booking
    if (/(how\s+do\s+i\s+cancel|cancel\s+booking|cancel\s+my\s+room)/.test(q)) {
      const ans = [
        'Cancel a booking:',
        '• Open the room you booked, then click Cancel booking in the modal.',
        '• Only the person who booked the room can see and use Cancel.',
      ].join('\n');
      await this.logChat(text, ans, false, 'cancel_help');
      return ans;
    }

    // Why can’t I cancel others?
    if (/(why\s+can.?t\s+i\s+cancel|cannot\s+cancel\s+someone|other\s+customer\s+cancel)/.test(q)) {
      const ans = 'Only the original booker can cancel a room. This is enforced by Row Level Security (RLS) in the database and by the UI.';
      await this.logChat(text, ans, false, 'rls_explain');
      return ans;
    }

    // How many days / 5-day limit
    if (/(how\s+many\s+days|days\s+limit|book\s+for\s+6|more\s+than\s+5)/.test(q)) {
      const ans = 'You can select 1–5 days per booking in the modal. Longer stays are not allowed in the current UI.';
      await this.logChat(text, ans, false, 'days_limit');
      return ans;
    }

    // Available rooms question
    if (/(what\s+rooms\s+are\s+available|available\s+rooms|which\s+rooms\s+are\s+free)/.test(q)) {
      const ans = 'Available rooms are marked with the Available badge on the Dashboard grid (green). Booked rooms are labeled Booked.';
      await this.logChat(text, ans, false, 'available_rooms_generic');
      return ans;
    }

    // Ask for rooms details & amenities
    if (/(what\s+rooms(\s+do\s+you\s+have)?|list\s+rooms|show\s+rooms|amenities|what\'s\s+included|whats\s+included)/.test(q)) {
      try {
        const rooms = await getRooms().catch(() => null);
        const source = rooms && rooms.length ? rooms : [
          { id: 1, name: 'Deluxe King', capacity: 2 },
          { id: 2, name: 'Twin Suite', capacity: 2 },
          { id: 3, name: 'Family Room', capacity: 4 },
          { id: 4, name: 'Queen Standard', capacity: 2 },
          { id: 5, name: 'Executive Suite', capacity: 3 },
        ] as any[];
        const lines = source.map(r => {
          const am = getRoomAmenities(r.id).join(', ') || 'Standard amenities';
          return `• Room ${r.id} – ${r.name} (capacity ${r.capacity}). Amenities: ${am}.`;
        });
        const ans = ['We offer the following rooms:', ...lines].join('\n');
        await this.logChat(text, ans, false, 'rooms_amenities_list');
        return ans;
      } catch {
        const lines = Object.entries(ROOM_AMENITIES).map(([id, am]) => `• Room ${id}: ${am.join(', ')}`);
        const ans = ['We offer multiple room types. Amenities include:', ...lines].join('\n');
        await this.logChat(text, ans, true, 'rooms_amenities_fallback');
        return ans;
      }
    }

    return null; // let AI try next
  }

  private parseDateToken(q: string): string | null {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (q.includes('today')) return toISO(today);
    if (q.includes('tomorrow')) {
      const t = new Date(today); t.setDate(t.getDate() + 1); return toISO(t);
    }
    const m = q.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
    if (m) {
      const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
      if (y > 1900 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      }
    }
    return null;
  }

  private async tryAvailability(q: string): Promise<string | null> {
    // Room-specific: "is room 2 available on 2025-11-03"
    const roomMatch = q.match(/room\s+(\d+)\s+(available|free)\s+(on|at|for)\s+(.*)/)
                    || q.match(/is\s+room\s+(\d+)\s+(available|free)(.*)/);
    const date = this.parseDateToken(q) || this.parseDateToken('today');
    if (roomMatch && date) {
      const id = Number(roomMatch[1]);
      try {
        // Prefer RPC (bypasses RLS for read via definer)
        const available = await isRoomAvailableRPC(id, date);
        const ans = available
          ? `Room ${id} is available on ${date}.`
          : `Room ${id} is NOT available on ${date}.`;
        await this.logChat(q, ans, false, 'availability_room_date');
        return ans;
      } catch {
        // RLS likely blocks bookings read; fall back to current room status only
        try {
          const rooms = await getRooms();
          const room = rooms.find(r => r.id === id);
          if (room) {
            const ans = `I couldn't check date-based bookings due to permissions. Based on current status, Room ${id} is ${room.status}.`;
            await this.logChat(q, ans, false, 'availability_room_status_fallback');
            return ans;
          }
        } catch {}
        // final: no info
        const ans = 'AI can’t solve that, please contact our key personnel.';
        await this.logChat(q, ans, true, 'availability_room_error');
        return ans;
      }
    }

    // Generic: "available rooms today/tomorrow/DATE"
    if (q.includes('available rooms') || q.includes('rooms available') || q.includes('which rooms are free')) {
      const when = this.parseDateToken(q) || this.parseDateToken('today');
      if (!when) return null;
      try {
        // Prefer RPC for date list
        const [rooms, availableIds] = await Promise.all([getRooms(), availableRoomsOnRPC(when)]);
        const available = rooms.filter(r => availableIds.includes(r.id));
        const list = available.length ? available.map(r => `${r.id} - ${r.name}`).join(', ') : 'none';
        const ans = `Available rooms on ${when}: ${list}`;
        await this.logChat(q, ans, false, 'availability_list_date');
        return ans;
      } catch {
        // RLS likely blocks bookings read; fall back to current room statuses only
        try {
          const rooms = await getRooms();
          const available = rooms.filter(r => r.status === 'available');
          const list = available.length ? available.map(r => `${r.id} - ${r.name}`).join(', ') : 'none';
          const ans = `I couldn't check date-based bookings due to permissions. Based on current statuses, available now: ${list}`;
          await this.logChat(q, ans, false, 'availability_list_status_fallback');
          return ans;
        } catch {}
      }
    }
    return null;
  }

  private async logChat(question: string, answer: string, isFallback: boolean, intent?: string): Promise<void> {
    try {
      const { data } = await supabase.auth.getUser();
      const userId: string | null = (data as any)?.user?.id ?? null;
      await supabase.from('chat_logs').insert({
        profile_id: userId,
        question,
        answer,
        is_fallback: isFallback,
        intent: intent ?? null,
      });
    } catch {
      // ignore log errors
    }
  }
}

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { supabaseAdmin } from '../services/supabase.service';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private _usersCache: any[] | null = null;
  private _usersSubject = new BehaviorSubject<any[] | null>(null);
  public users$ = this._usersSubject.asObservable();
  private _bookingsCache: any[] | null = null;
  private _bookingsSubject = new BehaviorSubject<any[] | null>(null);
  public bookings$ = this._bookingsSubject.asObservable();
  private _statsCache: any[] | null = null;
  private _statsSubject = new BehaviorSubject<any[] | null>(null);
  public stats$ = this._statsSubject.asObservable();
  private _roomsCache: any[] | null = null;
  private _roomsSubject = new BehaviorSubject<any[] | null>(null);
  public rooms$ = this._roomsSubject.asObservable();
  // Analytics cache + subjects
  private _analyticsSummaryCache: any | null = null;
  private _analyticsSummarySubject = new BehaviorSubject<any | null>(null);
  public analyticsSummary$ = this._analyticsSummarySubject.asObservable();

  private _dailyBookingsCache: any[] | null = null;
  private _dailyBookingsSubject = new BehaviorSubject<any[] | null>(null);
  public dailyBookings$ = this._dailyBookingsSubject.asObservable();
  private _topRoomsCache: any[] | null = null;
  private _topRoomsSubject = new BehaviorSubject<any[] | null>(null);
  public topRooms$ = this._topRoomsSubject.asObservable();
  // History (archived bookings) cache + subject
  private _historyCache: any[] | null = null;
  private _historySubject = new BehaviorSubject<any[] | null>(null);
  public history$ = this._historySubject.asObservable();

  async getUsers() {
    // Client environments should not call Supabase Admin APIs (they require
    // a service_role key). Always return data from the public `profiles`
    // table instead. For a full auth user list (with emails/metadata) create
    // a server-side endpoint or Supabase Edge Function that calls the Admin
    // API using the service_role key and returns the data to your admin UI.
    if (this._usersCache) {
      // ensure subject has the cached value
      try { this._usersSubject.next(this._usersCache); } catch (_) {}
      return this._usersCache;
    }
    try {
      const { data, error } = await supabaseAdmin.from('profiles').select('id, username, email, created_at');
      if (error) throw error;
      this._usersCache = data || [];
      try { this._usersSubject.next(this._usersCache); } catch (_) {}
      return this._usersCache;
    } catch (err) {
      console.warn('getUsers error', err);
      this._usersCache = [];
      try { this._usersSubject.next(this._usersCache); } catch (_) {}
      return this._usersCache;
    }
  }

  // Force refresh the cached users list
  async refreshUsers() {
    this._usersCache = null;
    try { this._usersSubject.next(null); } catch (_) {}
    return this.getUsers();
  }

  // Bookings cache + fetch
  async getBookings(limit = 200) {
    if (this._bookingsCache) {
      try { this._bookingsSubject.next(this._bookingsCache); } catch (_) {}
      return this._bookingsCache;
    }
    try {
      // Try admin RPC first (bypasses RLS for admin portal). Fallback to
      // client-side select which will only return owner bookings under RLS.
      try {
        const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('admin_list_bookings');
        if (!rpcErr && rpcData) {
          // rpc returns rows with a `rooms` json column. Enrich username when
          // the denormalized value is missing by fetching profiles for any
          // returned profile_id values. This handles older bookings inserted
          // before the username denormalization was added.
          let rows = rpcData as any[];
          const missing = rows.filter(r => !r.username && r.profile_id);
          if (missing.length) {
            try {
              const ids = missing.map(m => m.profile_id).filter(Boolean);
              const { data: profiles } = await supabaseAdmin.from('profiles').select('id, username').in('id', ids);
              const map: Record<string, string> = {} as any;
              (profiles || []).forEach((p: any) => { map[p.id] = p.username; });
              rows = rows.map(r => ({ ...r, username: r.username || map[r.profile_id] || null }));
            } catch (e) {
              // ignore enrichment errors and continue with rpc rows
            }
          }
          // Ensure a sensible default for status so the UI shows meaningful values
          this._bookingsCache = rows.map(r => ({ ...r, status: r.status || 'booked' }));
          try { this._bookingsSubject.next(this._bookingsCache); } catch (_) {}
          return this._bookingsCache;
        }
      } catch (e) {
        // ignore RPC errors and try direct select below
      }

      const { data, error } = await supabaseAdmin
        .from('bookings')
        .select('id, username, checkin_date, checkout_date, created_at, status, rooms(id, name)')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      let rows = (data || []) as any[];
      rows = rows.map(r => ({ ...r, status: r.status || 'booked' }));
      this._bookingsCache = rows;
      try { this._bookingsSubject.next(this._bookingsCache); } catch (_) {}
      return this._bookingsCache;
    } catch (err) {
      console.warn('getBookings error', err);
      this._bookingsCache = [];
      try { this._bookingsSubject.next(this._bookingsCache); } catch (_) {}
      return this._bookingsCache;
    }
  }

  async refreshBookings() {
    this._bookingsCache = null;
    try { this._bookingsSubject.next(null); } catch (_) {}
    return this.getBookings();
  }

  // Fetch archived bookings from history_bookings
  async getHistoryBookings(limit = 1000) {
    if (this._historyCache) {
      try { this._historySubject.next(this._historyCache); } catch (_) {}
      return this._historyCache;
    }
    try {
      // Directly select from history_bookings to avoid relying on an RPC.
      const { data, error } = await supabaseAdmin
        .from('history_bookings')
        .select('id, profile_id, username, room_id, rooms, checkin_date, checkout_date, created_at, status, archived_at')
        .order('archived_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      let rows = (data || []) as any[];

      // Enrich missing usernames when profile_id exists
      const missing = rows.filter(r => !r.username && r.profile_id);
      if (missing.length) {
        try {
          const ids = Array.from(new Set(missing.map(m => m.profile_id).filter(Boolean)));
          const { data: profiles } = await supabaseAdmin.from('profiles').select('id, username').in('id', ids);
          const map: Record<string, string> = {} as any;
          (profiles || []).forEach((p: any) => { map[p.id] = p.username; });
          rows = rows.map(r => ({ ...r, username: r.username || map[r.profile_id] || null }));
        } catch (_) {}
      }

      // If rows lack a `rooms` json and have room_id values, try to fetch room names.
      // Query both string and numeric forms so we work across environments where
      // `rooms.id` and `history_bookings.room_id` may differ in type (uuid vs int).
      const needRooms = rows.filter(r => (!r.rooms || Object.keys(r.rooms || {}).length === 0) && r.room_id).map(r => r.room_id);
      if (needRooms.length) {
        try {
          const rawIds = Array.from(new Set(needRooms.filter(Boolean)));
          const stringIds = rawIds.map(String).filter(Boolean);
          const numericIds = rawIds.map((id: any) => Number(id)).filter(n => !Number.isNaN(n));

          let roomRows: any[] = [];
          if (stringIds.length) {
            try {
              const { data: rr } = await supabaseAdmin.from('rooms').select('id, name').in('id', stringIds as any[]);
              if (rr && rr.length) roomRows = roomRows.concat(rr as any[]);
            } catch (_) {}
          }
          if (numericIds.length) {
            try {
              const { data: rr2 } = await supabaseAdmin.from('rooms').select('id, name').in('id', numericIds as any[]);
              if (rr2 && rr2.length) roomRows = roomRows.concat(rr2 as any[]);
            } catch (_) {}
          }

          const roomMap: Record<string, any> = {} as any;
          (roomRows || []).forEach((rm: any) => { roomMap[String(rm.id)] = rm; });
          rows = rows.map(r => ({ ...r, rooms: r.rooms || roomMap[String(r.room_id)] || null }));
        } catch (_) {}
      }

      // Default status for history rows when missing
      this._historyCache = rows.map(r => ({ ...r, status: r.status || 'booked' }));
      try { this._historySubject.next(this._historyCache); } catch (_) {}
      return this._historyCache;
    } catch (err) {
      console.warn('getHistoryBookings error', err);
      this._historyCache = [];
      try { this._historySubject.next(this._historyCache); } catch (_) {}
      return this._historyCache;
    }
  }

  async refreshHistoryBookings() {
    this._historyCache = null;
    try { this._historySubject.next(null); } catch (_) {}
    return this.getHistoryBookings();
  }

  async updateUserRole(userId: string, role: string) {
    try {
      const { data, error } = await supabaseAdmin.from('profiles').update({ role }).eq('id', userId).select();
      if (error) {
        // If the profiles table does not have a `role` column, surface a
        // clearer error so the admin UI can handle it.
        if ((error as any)?.code === '42703') {
          throw new Error('profiles table does not contain a `role` column');
        }
        throw error;
      }
      return data?.[0] ?? null;
    } catch (err) {
      console.warn('updateUserRole error', err);
      throw err;
    }
  }

  // getBookingStats with caching
  async getBookingStats() {
    if (this._statsCache) {
      try { this._statsSubject.next(this._statsCache); } catch (_) {}
      return this._statsCache;
    }
    try {
      // Example aggregation: bookings per room
      // Try RPC first (optional), fallback to client aggregation
      try {
        const { data, error } = await supabaseAdmin.rpc('bookings_per_room');
        if (!error && data) {
          this._statsCache = data || [];
          try { this._statsSubject.next(this._statsCache); } catch (_) {}
          return this._statsCache;
        }
      } catch {}
      const { data: d2 } = await supabaseAdmin.from('bookings').select('room_id');
      const counts: Record<number, number> = {} as any;
      (d2 || []).forEach((b: any) => { counts[b.room_id] = (counts[b.room_id] || 0) + 1; });
      const result = Object.entries(counts).map(([room_id, count]) => ({ room_id: Number(room_id), count }));
      this._statsCache = result;
      try { this._statsSubject.next(this._statsCache); } catch (_) {}
      return this._statsCache;
    } catch (err) {
      console.warn('getBookingStats error', err);
      this._statsCache = [];
      try { this._statsSubject.next(this._statsCache); } catch (_) {}
      return this._statsCache;
    }
  }

  // Rooms cache + fetch
  async getRooms(limit = 200) {
    if (this._roomsCache) {
      try { this._roomsSubject.next(this._roomsCache); } catch (_) {}
      return this._roomsCache;
    }
    try {
      // Prefer a direct select (avoids noisy 404 when RPC isn't installed).
      const { data, error } = await supabaseAdmin
        .from('rooms')
        .select('id, name, short, capacity, price, image, status')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (!error && data) {
        this._roomsCache = data || [];
        try { this._roomsSubject.next(this._roomsCache); } catch (_) {}
        return this._roomsCache;
      }

      // If the direct select failed for some reason, try an admin RPC as a fallback.
      try {
        const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('admin_list_rooms');
        if (!rpcErr && rpcData) {
          this._roomsCache = rpcData as any[];
          try { this._roomsSubject.next(this._roomsCache); } catch (_) {}
          return this._roomsCache;
        }
      } catch (rpcErr) {
        // ignore rpc errors
      }

      if (error) throw error;
      this._roomsCache = [];
      try { this._roomsSubject.next(this._roomsCache); } catch (_) {}
      return this._roomsCache;
    } catch (err) {
      console.warn('getRooms error', err);
      this._roomsCache = [];
      try { this._roomsSubject.next(this._roomsCache); } catch (_) {}
      return this._roomsCache;
    }
  }

  async refreshRooms() {
    this._roomsCache = null;
    try { this._roomsSubject.next(null); } catch (_) {}
    return this.getRooms();
  }

  // Analytics methods
  async getAnalyticsSummary(p_days = 30) {
    if (this._analyticsSummaryCache) {
      try { this._analyticsSummarySubject.next(this._analyticsSummaryCache); } catch (_) {}
      return this._analyticsSummaryCache;
    }
    try {
      // Prefer RPC for server-side aggregation (RPC should be SECURITY DEFINER)
      try {
        const { data, error } = await supabaseAdmin.rpc('admin_get_analytics_summary', { p_days });
        if (!error && data) {
          // RPC returns a rowset; pick the first row and normalize column names
          const row = Array.isArray(data) ? (data as any[])[0] : data;
          const mapped = row ? {
            totalRooms: row.total_rooms ?? row.totalRooms ?? row.totalrooms ?? 0,
            totalBookings: row.total_bookings ?? row.totalBookings ?? row.totalbookings ?? 0,
            revenue: row.revenue ?? 0,
            cancelled: row.cancelled ?? row.canceled ?? 0,
            cancellationRate: row.cancellation_rate ?? row.cancellationRate ?? 0
          } : { totalRooms: 0, totalBookings: 0, revenue: 0, cancelled: 0, cancellationRate: 0 };
          this._analyticsSummaryCache = mapped;
          try { this._analyticsSummarySubject.next(this._analyticsSummaryCache); } catch (_) {}
          return this._analyticsSummaryCache;
        }
      } catch (_) {}

      // Fallback: perform client-side aggregation (may be slow/unreliable under RLS)
      const since = new Date();
      since.setDate(since.getDate() - p_days);
      const sinceIso = since.toISOString();
      // Get exact rooms count (use select with count option)
      const { data: roomData, count: roomCount } = await supabaseAdmin.from('rooms').select('id', { count: 'exact' });
      const { data: bookings } = await supabaseAdmin.from('bookings').select('id,total_amount,total_price,created_at,checkin_date,checkout_date,status').gte('created_at', sinceIso);
      const totalRooms = (roomCount as number) || (Array.isArray(roomData) ? roomData.length : 0);
      const bookingsArr = (bookings as any[] || []);
      // Prefer total_amount, fall back to total_price
      const revenue = bookingsArr.reduce((s, b) => s + (Number(b.total_amount) || Number(b.total_price) || 0), 0);
      const totalBookings = bookingsArr.length;
      const cancelled = bookingsArr.filter(b => b.status === 'cancelled').length;
      const summary = { totalRooms, totalBookings, revenue, cancelled, cancellationRate: totalBookings ? (cancelled / totalBookings) : 0 };
      this._analyticsSummaryCache = summary;
      try { this._analyticsSummarySubject.next(this._analyticsSummaryCache); } catch (_) {}
      return this._analyticsSummaryCache;
    } catch (err) {
      console.warn('getAnalyticsSummary error', err);
      this._analyticsSummaryCache = { totalRooms: 0, totalBookings: 0, revenue: 0, cancelled: 0, cancellationRate: 0 };
      try { this._analyticsSummarySubject.next(this._analyticsSummaryCache); } catch (_) {}
      return this._analyticsSummaryCache;
    }
  }

  async refreshAnalytics() {
    this._analyticsSummaryCache = null;
    this._dailyBookingsCache = null;
    try { this._analyticsSummarySubject.next(null); } catch (_) {}
    try { this._dailyBookingsSubject.next(null); } catch (_) {}
    await Promise.all([ this.getAnalyticsSummary().catch(() => {}), this.getDailyBookings().catch(() => {}), this.getTopRooms().catch(() => {}) ]);
  }

  async getTopRooms(p_days = 30, p_limit = 10) {
    if (this._topRoomsCache) {
      try { this._topRoomsSubject.next(this._topRoomsCache); } catch (_) {}
      return this._topRoomsCache;
    }
    try {
      // Try RPC first
      try {
        const { data, error } = await supabaseAdmin.rpc('admin_get_top_rooms', { p_days, p_limit });
        if (!error && data) {
          // Normalize RPC rows: ensure room_id is a string for consistent frontend keys
          const rows = (data as any[]).map(r => ({
            room_id: r.room_id != null ? String(r.room_id) : '',
            name: r.name ?? (r.room_id != null ? String(r.room_id) : ''),
            count: Number(r.count) || 0,
            revenue: Number(r.revenue) || 0
          }));
          this._topRoomsCache = rows;
          try { this._topRoomsSubject.next(this._topRoomsCache); } catch (_) {}
          return this._topRoomsCache;
        }
        if (error) {
          console.warn('admin_get_top_rooms RPC error', error);
        }
      } catch (_) {}

      // Fallback: client-side aggregation
      const since = new Date();
      since.setDate(since.getDate() - p_days);
      const sinceIso = since.toISOString();
      const { data: rows } = await supabaseAdmin.from('bookings').select('room_id').gte('created_at', sinceIso);
      const counts: Record<string, number> = {} as any;
      (rows || []).forEach((r: any) => { const k = String(r.room_id || ''); if (k) counts[k] = (counts[k] || 0) + 1; });
      const entries = Object.entries(counts).map(([room_id, count]) => ({ room_id, count }));
      // Fetch room names
      const ids = entries.map(e => e.room_id).filter(Boolean);
      let roomRows: any[] = [];
      if (ids.length) {
        // Try numeric ids first, then string ids to handle mixed types
        const numericIds = ids.map(i => Number(i)).filter(n => !Number.isNaN(n));
        const stringIds = ids.filter(i => String(i).trim() !== '');
        try {
          if (numericIds.length) {
            const { data: rr } = await supabaseAdmin.from('rooms').select('id,name').in('id', numericIds as any[]);
            if (rr) roomRows = roomRows.concat(rr as any[]);
          }
        } catch (_) {}
        try {
          // Also try string matches if numeric didn't find everything
          if (stringIds.length) {
            const { data: rr2 } = await supabaseAdmin.from('rooms').select('id,name').in('id', stringIds as any[]);
            if (rr2) roomRows = roomRows.concat(rr2 as any[]);
          }
        } catch (_) {}
      }
      const map: Record<string, any> = {} as any;
      (roomRows || []).forEach(r => { map[String(r.id)] = r; });
      const out = entries.map(e => ({ room_id: e.room_id, name: (map[e.room_id] && map[e.room_id].name) || e.room_id, count: e.count }));
      out.sort((a,b) => (b.count || 0) - (a.count || 0));
      this._topRoomsCache = out.slice(0, p_limit);
      try { this._topRoomsSubject.next(this._topRoomsCache); } catch (_) {}
      return this._topRoomsCache;
    } catch (err) {
      console.warn('getTopRooms error', err);
      this._topRoomsCache = [];
      try { this._topRoomsSubject.next(this._topRoomsCache); } catch (_) {}
      return this._topRoomsCache;
    }
  }

  async refreshTopRooms() {
    this._topRoomsCache = null;
    try { this._topRoomsSubject.next(null); } catch (_) {}
    return this.getTopRooms();
  }

  async getDailyBookings(p_days = 30, p_room_id: any = null) {
    if (this._dailyBookingsCache) {
      try { this._dailyBookingsSubject.next(this._dailyBookingsCache); } catch (_) {}
      return this._dailyBookingsCache;
    }
    try {
      try {
        const { data, error } = await supabaseAdmin.rpc('admin_get_daily_stats', { p_days, p_room_id });
        if (!error && data) {
          this._dailyBookingsCache = data as any[];
          try { this._dailyBookingsSubject.next(this._dailyBookingsCache); } catch (_) {}
          return this._dailyBookingsCache;
        }
      } catch (_) {}

      // Fallback: compute client-side
      const since = new Date();
      since.setDate(since.getDate() - p_days);
      const sinceIso = since.toISOString();
      const { data: rows } = await supabaseAdmin.from('bookings').select('created_at,total_price').gte('created_at', sinceIso);
      const map: Record<string, number> = {} as any;
      (rows || []).forEach((r: any) => {
        const d = (new Date(r.created_at)).toISOString().slice(0,10);
        map[d] = (map[d] || 0) + 1;
      });
      const out: any[] = [];
      for (let i = p_days - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0,10);
        out.push({ day: key, bookings: map[key] || 0 });
      }
      this._dailyBookingsCache = out;
      try { this._dailyBookingsSubject.next(this._dailyBookingsCache); } catch (_) {}
      return this._dailyBookingsCache;
    } catch (err) {
      console.warn('getDailyBookings error', err);
      this._dailyBookingsCache = [];
      try { this._dailyBookingsSubject.next(this._dailyBookingsCache); } catch (_) {}
      return this._dailyBookingsCache;
    }
  }
}

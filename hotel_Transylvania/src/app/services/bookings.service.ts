import { supabase } from './supabase.service';

export type Booking = {
  id: string;
  room_id: number;
  profile_id: string | null;
  checkin_date: string; // YYYY-MM-DD
  checkout_date: string; // YYYY-MM-DD
  status: string;
  created_at: string;
};

export async function createBooking(
  roomId: number | string,
  userId: string,
  checkinDate: string,
  checkoutDate: string
): Promise<Booking | null> {
  // Prefer calling the SECURITY DEFINER RPC which performs the insert and
  // room update atomically. Fallback to direct insert if RPC isn't available.
  try {
    const { data, error } = await supabase.rpc('create_booking', {
      // pass room id as text so the RPC can resolve either int or uuid ids
      p_room_id: String(roomId),
      p_checkin: checkinDate,
      p_checkout: checkoutDate,
    } as any);
    if (error) throw error;
    // RPC returns the booking row
    return (data as Booking) ?? null;
  } catch (rpcErr) {
    // Fallback: try direct insert (may be blocked by RLS/FK).
    // Instead of trusting the caller-provided userId (which may be wrong),
    // fetch the authenticated user's id from Supabase so we insert a valid UUID.
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = (userData as any)?.user?.id;
      if (!uid || typeof uid !== 'string' || !/^[0-9a-fA-F-]{36}$/.test(uid)) {
        throw new Error('Authenticated user id is missing or invalid; cannot perform direct insert. Ensure you are signed in.');
      }
      // Resolve the actual room id value from the rooms table so the insert
      // uses the DB-native type (int or uuid). Try several match strategies.
      let resolvedRoomId: any = null;
      try {
        // Try matching string form first (works if rooms.id is uuid/text)
        const { data: roomStr, error: roomStrErr } = await supabase
          .from('rooms')
          .select('id')
          .eq('id', String(roomId))
          .maybeSingle();
        if (!roomStrErr && roomStr && (roomStr as any).id !== undefined) resolvedRoomId = (roomStr as any).id;
      } catch {}
      if (resolvedRoomId == null) {
        // Try numeric form (works if rooms.id is integer)
        const asNumber = Number(roomId);
        if (!Number.isNaN(asNumber)) {
          try {
            const { data: roomNum, error: roomNumErr } = await supabase
              .from('rooms')
              .select('id')
              .eq('id', asNumber)
              .maybeSingle();
            if (!roomNumErr && roomNum && (roomNum as any).id !== undefined) resolvedRoomId = (roomNum as any).id;
          } catch {}
        }
      }

      // If we still couldn't resolve, fall back to using the raw provided value.
      const roomIdToInsert = resolvedRoomId != null ? resolvedRoomId : roomId;

      const { data, error } = await supabase
        .from('bookings')
        .insert({
          room_id: roomIdToInsert,
          profile_id: uid,
          checkin_date: checkinDate,
          checkout_date: checkoutDate,
          status: 'booked',
        })
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return (data as Booking) ?? null;
    } catch (directErr) {
      // If the RPC is missing (404) or the direct insert failed, surface a
      // clear error so callers can act (for example, run the RPC SQL in Supabase).
      // Prefer to rethrow the original RPC error if it has useful info.
      const msg = (rpcErr && (rpcErr as any).message) ? (rpcErr as any).message : String(rpcErr);
      throw new Error(`Create booking failed. RPC error: ${msg}. Direct insert error: ${directErr instanceof Error ? directErr.message : String(directErr)}`);
    }
  }
}

export async function cancelBooking(roomId: number, userId: string): Promise<boolean> {
  // Archive the user's booking by moving it to `history_bookings` then
  // removing it from `bookings`. We first locate the booking id, then
  // call the SECURITY DEFINER RPC `rpc_archive_booking` to perform the
  // archive atomically on the server.
  try {
    const { data: row, error: selErr } = await supabase
      .from('bookings')
      .select('id')
      .eq('room_id', roomId)
      .eq('profile_id', userId)
      .eq('status', 'booked')
      .maybeSingle();
    if (selErr) throw selErr;
    const bookingId = (row as any)?.id;
    if (!bookingId) return false;

    // Try server-side archival first. If the RPC is not present or the
    // DB hasn't been migrated, fall back to updating the booking status to
    // 'cancelled' and marking the room available. This ensures the cancel
    // flow still works even when the history table/RPCs are not installed.
      try {
      // Prefer calling the unambiguous force wrapper to avoid PostgREST overload
      // resolution errors. If that isn't present, fall back to the original RPC.
      try {
        const { data: archived, error: rpcErr } = await supabase.rpc('rpc_archive_booking_force', { p_id: String(bookingId) } as any);
        if (!rpcErr) return !!archived;
        // If wrapper not found or errored, fall through to try the non-wrapper RPCs
        console.warn('rpc_archive_booking_force returned error, trying other RPCs:', rpcErr);
      } catch (wrapEx) {
        // ignore and try legacy RPCs
        console.warn('rpc_archive_booking_force call failed, trying legacy RPCs:', wrapEx);
      }

      // Try original RPC (may be present in some DBs)
      try {
        const { data: archived, error: rpcErr } = await supabase.rpc('rpc_archive_booking', { p_id: String(bookingId) } as any);
        if (!rpcErr) return !!archived;
        if ((rpcErr as any)?.code === 'PGRST203') {
          // Ambiguous function selection — call an unambiguous text wrapper if available
          try {
            const { data: archived2, error: rpcErr2 } = await supabase.rpc('rpc_archive_booking_text_force', { p_id: String(bookingId) } as any);
            if (!rpcErr2) return !!archived2;
            console.warn('rpc_archive_booking_text_force returned error, falling back to update:', rpcErr2);
          } catch (rpcEx2) {
            console.warn('rpc_archive_booking_text_force call failed, falling back to update:', rpcEx2);
          }
        } else {
          console.warn('rpc_archive_booking returned error, falling back to update:', rpcErr);
        }
      } catch (rpcEx) {
        console.warn('rpc_archive_booking call failed, falling back to update:', rpcEx);
      }
    } catch (e) {
      console.warn('archive RPC attempts failed, falling back to update:', e);
    }

    // Fallback behavior: update booking row to status='cancelled' and
    // mark the room as available. These operations are performed as the
    // authenticated user and should be allowed by RLS policies defined in
    // the schema (users can update their own bookings and cancel rooms they
    // previously booked).
    try {
      const { data: upd, error: updErr } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId)
        .eq('profile_id', userId)
        .select();
      if (updErr) throw updErr;
      // Make the room available again (best-effort). RLS permits this when
      // the current user is the original `booked_by` value.
      try {
        const { error: roomErr } = await supabase
          .from('rooms')
          .update({ status: 'available', booked_by: null })
          .eq('id', roomId)
          .eq('booked_by', userId);
        if (roomErr) console.warn('Failed to mark room available after cancel:', roomErr);
      } catch (re) {
        console.warn('Room availability update failed', re);
      }
      return true;
    } catch (fallbackErr) {
      console.warn('Fallback cancel failed', fallbackErr);
      throw fallbackErr;
    }
  } catch (err) {
    throw err;
  }
}

// Get bookings for a specific date (active stays where checkin_date <= date < checkout_date)
export async function getBookedRoomIdsOnDate(date: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('room_id')
    .eq('status', 'booked')
    .lte('checkin_date', date)
    .gt('checkout_date', date);
  if (error) throw error;
  const rows = (data as { room_id: number }[]) || [];
  return rows.map(r => r.room_id);
}

// Check if one room is booked on a date
export async function isRoomBookedOnDate(roomId: number, date: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id')
    .eq('room_id', roomId)
    .eq('status', 'booked')
    .lte('checkin_date', date)
    .gt('checkout_date', date)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

// RPC wrappers for availability (SECURITY DEFINER on DB)
export async function isRoomAvailableRPC(roomId: number, date: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_room_available', { room_id: roomId, on_date: date });
  if (error) throw error;
  return !!data;
}

export async function availableRoomsOnRPC(date: string): Promise<number[]> {
  const { data, error } = await supabase.rpc('available_rooms_on', { on_date: date });
  if (error) throw error;
  return (data as number[]) ?? [];
}

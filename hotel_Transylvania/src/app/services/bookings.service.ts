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
  roomId: number,
  userId: string,
  checkinDate: string,
  checkoutDate: string
): Promise<Booking | null> {
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      room_id: roomId,
      profile_id: userId,
      checkin_date: checkinDate,
      checkout_date: checkoutDate,
      status: 'booked',
    })
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return (data as Booking) ?? null;
}

export async function cancelBooking(roomId: number, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('room_id', roomId)
    .eq('profile_id', userId)
    .eq('status', 'booked')
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return !!data;
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

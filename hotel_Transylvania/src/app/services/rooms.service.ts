import { supabase } from './supabase.service';

export type RoomDb = {
  id: number;
  name: string;
  image: string;
  description: string;
  capacity: number;
  status: 'available' | 'booked';
  booked_by: string | null;
  short?: string | null;
};

export async function getRooms(): Promise<RoomDb[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('id,name,image,description,capacity,status,booked_by,short')
    .order('id');
  if (error) throw error;
  return (data as RoomDb[]) ?? [];
}

export async function seedRooms(rooms: RoomDb[]): Promise<void> {
  // Upsert to avoid duplicates if IDs exist
  const { error } = await supabase.from('rooms').upsert(rooms, { onConflict: 'id' });
  if (error) throw error;
}

export async function bookRoom(id: number, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('rooms')
    .update({ status: 'booked', booked_by: userId })
    .eq('id', id)
    .eq('status', 'available')
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function cancelRoom(id: number, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('rooms')
    .update({ status: 'available', booked_by: null })
    .eq('id', id)
    .eq('booked_by', userId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

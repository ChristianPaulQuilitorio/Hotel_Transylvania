import { supabase } from './supabase.service';

export type RoomDb = {
  id: number;
  name: string;
  image: string;
  description: string;
  capacity: number;
  status: 'available' | 'booked';
  booked_by: string | null;
  price?: number | null;
  amenities?: string[] | null;
  short?: string | null;
};

// Local amenities catalog keyed by room id. Used in UI and chatbot answers.
export const ROOM_AMENITIES: Record<number, string[]> = {
  1: ['King bed', 'City view', 'Wi‑Fi', 'Air conditioning', 'Private bathroom', 'Smart TV', 'Complimentary breakfast'],
  2: ['Two twin beds', 'Workspace', 'Wi‑Fi', 'Air conditioning', 'Mini fridge', 'Smart TV'],
  3: ['Family capacity (4)', 'Extra bedding on request', 'Wi‑Fi', 'Air conditioning', 'Smart TV', 'Crib available'],
  4: ['Queen bed', 'Wi‑Fi', 'Air conditioning', 'Private bathroom', 'Smart TV'],
  5: ['Separate living area', 'Workspace', 'Wi‑Fi', 'Air conditioning', 'Nespresso machine', 'Smart TV', 'Premium toiletries'],
};

export function getRoomAmenities(id: number): string[] {
  return ROOM_AMENITIES[id] ?? [];
}

export async function getRooms(): Promise<RoomDb[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('id,name,image,description,capacity,status,booked_by,short,price,amenities')
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

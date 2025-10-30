import { Injectable } from '@angular/core';
import { supabase } from './supabase.service';

export interface RatingSummary { average: number; count: number; }
export interface UserRating { rating: number; comment?: string; }

const LS_KEY = 'room-ratings-v1';

function readLocal(): any[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function writeLocal(items: any[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch {}
}

@Injectable({ providedIn: 'root' })
export class RatingsService {
  async getSummary(roomId: number): Promise<RatingSummary> {
    // Try Supabase first
    try {
      const { data, error } = await supabase
        .from('ratings')
        .select('rating')
        .eq('room_id', roomId);
      if (!error && Array.isArray(data) && data.length) {
        const sum = (data as any[]).reduce((a, r) => a + (Number(r.rating) || 0), 0);
        return { average: sum / data.length, count: data.length };
      }
    } catch {}
    // Fallback: localStorage
    const items = readLocal().filter(r => r.room_id === roomId);
    if (items.length === 0) return { average: 0, count: 0 };
    const sum = items.reduce((a, r) => a + (Number(r.rating) || 0), 0);
    return { average: sum / items.length, count: items.length };
  }

  async getUserRating(roomId: number, userId: string): Promise<UserRating | null> {
    try {
      const { data } = await supabase
        .from('ratings')
        .select('rating, comment')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .single();
      if (data) return { rating: (data as any).rating, comment: (data as any).comment };
    } catch {}
    const items = readLocal();
    const found = items.find(r => r.room_id === roomId && r.user_id === userId);
    return found ? { rating: found.rating, comment: found.comment } : null;
  }

  async submit(roomId: number, userId: string, stars: number, comment?: string): Promise<void> {
    // Normalize
    const rating = Math.max(1, Math.min(5, Math.round(stars)));
    // Try Supabase upsert on (room_id, user_id)
    try {
      const { data, error } = await supabase
        .from('ratings')
        .upsert({ room_id: roomId, user_id: userId, rating, comment }, { onConflict: 'room_id,user_id' });
      if (!error) {
        return;
      }
      // If Supabase returned an error, fall through to local fallback
      console.warn('Ratings upsert failed, falling back to localStorage', error);
    } catch {}
    // Fallback local storage (dedupe by room + user)
    const items = readLocal();
    const idx = items.findIndex((r: any) => r.room_id === roomId && r.user_id === userId);
    const entry = { room_id: roomId, user_id: userId, rating, comment, updated_at: Date.now() };
    if (idx >= 0) items[idx] = entry; else items.push(entry);
    writeLocal(items);
  }
}

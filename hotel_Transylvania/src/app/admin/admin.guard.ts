import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { supabase, getUser } from '../services/supabase.service';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(private router: Router) {}

  async canActivate(): Promise<boolean> {
    try {
      const { data } = await getUser();
      const user = (data as any)?.user;
      if (!user?.id) {
        this.router.navigate(['/login']);
        return false;
      }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      const role = (profile as any)?.role;
      if (role === 'admin') return true;
      // not allowed
      this.router.navigate(['/dashboard']);
      return false;
    } catch (err) {
      console.warn('AdminGuard error', err);
      try { this.router.navigate(['/dashboard']); } catch {}
      return false;
    }
  }
}

import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { supabaseAdmin } from '../services/supabase.service';

@Injectable({ providedIn: 'root' })
export class PortalGuard implements CanActivate {
  constructor(private router: Router) {}
  async canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean> {
    // allow navigating to the login page
    if (state.url && state.url.includes('/admin-portal/login')) return true;

    try {
      const { data } = await supabaseAdmin.auth.getUser();
      const user = (data as any)?.user;
      if (!user) {
        this.router.navigate(['/admin-portal','login']);
        return false;
      }
      const { data: profile, error } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', user.id).single();
      if (error || !(profile as any)?.is_admin) {
        this.router.navigate(['/admin-portal','login']);
        return false;
      }
      return true;
    } catch (e) {
      this.router.navigate(['/admin-portal','login']);
      return false;
    }
  }
}

import { Routes } from '@angular/router';
import { AdminGuard } from './admin/admin.guard';
import { PortalGuard } from './admin-portal/portal-guard.service';

export const routes: Routes = [
	{
		path: 'login',
		loadComponent: () =>
			import('./auth/login.component').then((m) => m.LoginComponent),
		data: { preload: true }
	},
	{
		path: 'signup',
		loadComponent: () =>
			import('./auth/signup.component').then((m) => m.SignupComponent),
		data: { preload: true }
	},
	{
		path: 'admin',
		loadComponent: () => import('./admin/admin.component').then((m) => m.AdminComponent),
		canActivate: [AdminGuard],
		data: { preload: false },
	},
	{
		path: 'admin-portal/login',
		loadComponent: () => import('./admin-portal/admin-login.component').then((m) => m.AdminLoginComponent),
		data: { preload: false }
	},
	{
		path: 'admin-portal',
		loadComponent: () => import('./admin-portal/admin-landing.component').then((m) => m.AdminLandingComponent),
		data: { preload: false }
	},
	{
		path: 'admin-portal/app',
		loadComponent: () => import('./admin-portal/admin-shell.component').then((m) => m.AdminShellComponent),
		canActivate: [PortalGuard],
		data: { preload: false }
	},
	{
		path: 'admin-portal/app/users',
		loadComponent: () => import('./admin-portal/portal-users.component').then((m) => m.PortalUsersComponent),
		canActivate: [PortalGuard],
		data: { preload: false }
	},
	{
		path: 'admin-portal/app/rooms',
		loadComponent: () => import('./admin-portal/portal-rooms.component').then((m) => m.PortalRoomsComponent),
		canActivate: [PortalGuard],
		data: { preload: false }
	},
	{
		path: 'admin-portal/app/bookings',
		loadComponent: () => import('./admin-portal/portal-bookings.component').then((m) => m.PortalBookingsComponent),
		canActivate: [PortalGuard],
		data: { preload: false }
	},
	{
		path: 'admin-portal/app/analytics',
		loadComponent: () => import('./admin-portal/portal-analytics.component').then((m) => m.PortalAnalyticsComponent),
		canActivate: [PortalGuard],
		data: { preload: false }
	},
	{
		path: 'admin/users',
		loadComponent: () => import('./admin/users.component').then((m) => m.AdminUsersComponent),
		canActivate: [AdminGuard],
		data: { preload: false },
	},
	{
		path: 'admin/bookings',
		loadComponent: () => import('./admin/bookings.component').then((m) => m.AdminBookingsComponent),
		canActivate: [AdminGuard],
		data: { preload: false },
	},
	{
		path: 'admin/analytics',
		loadComponent: () => import('./admin/analytics.component').then((m) => m.AdminAnalyticsComponent),
		canActivate: [AdminGuard],
		data: { preload: false },
	},
	{
		path: 'dashboard',
		loadComponent: () =>
			import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
		data: { preload: true }
	},
		{
			path: 'settings',
			loadComponent: () =>
				import('./settings/settings.component').then((m) => m.SettingsComponent),
			data: { preload: true }
		},
	{
		path: '',
		loadComponent: () =>
			import('./landing/landing.component').then((m) => m.LandingComponent),
		data: { preload: true }
	},
];

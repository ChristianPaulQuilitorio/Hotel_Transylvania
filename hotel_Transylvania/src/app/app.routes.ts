import { Routes } from '@angular/router';

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

import { Routes } from '@angular/router';

export const routes: Routes = [
	{
		path: 'login',
		loadComponent: () =>
			import('./auth/login.component').then((m) => m.LoginComponent),
	},
	{
		path: 'signup',
		loadComponent: () =>
			import('./auth/signup.component').then((m) => m.SignupComponent),
	},
	{
		path: 'dashboard',
		loadComponent: () =>
			import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
	},
		{
			path: 'settings',
			loadComponent: () =>
				import('./settings/settings.component').then((m) => m.SettingsComponent),
		},
	{
		path: '',
		loadComponent: () =>
			import('./landing/landing.component').then((m) => m.LandingComponent),
	},
];

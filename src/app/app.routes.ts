import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', loadChildren: () => import('./features/login/login.module').then((module) => module.LoginModule) },
  { path: 'dashboard', loadChildren: () => import('./features/dashboard/dashboard.module').then((module) => module.DashboardModule) },
  { path: '**', redirectTo: 'login' },
];

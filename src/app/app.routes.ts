import { Routes } from '@angular/router';
import { authGuard, publicGuard } from '@app/auth/auth.guards';
import { requireRole } from '@app/auth/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [publicGuard],
    loadComponent: () => import('@app/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'signup',
    canActivate: [publicGuard],
    loadComponent: () => import('@app/signup/signup.page').then((m) => m.SignupPage),
  },
  {
    path: 'claim',
    canActivate: [publicGuard],
    loadComponent: () => import('@app/claim/claim.page').then((m) => m.ClaimPage),
  },
  {
    path: 'admin',
    canActivate: [authGuard, requireRole('admin')],
    loadChildren: () => import('@app/admin/admin.routes').then((m) => m.routes),
  },
  {
    path: 'parent',
    canActivate: [authGuard, requireRole('parent')],
    loadChildren: () => import('@app/parent/parent.routes').then((m) => m.routes),
  },
  {
    path: 'employee',
    canActivate: [authGuard, requireRole('employee')],
    loadChildren: () => import('@app/employee/employee.routes').then((m) => m.routes),
  },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('@app/root/root.page').then((m) => m.RootPage),
  },
  {
    path: '**',
    redirectTo: '',
  },
];

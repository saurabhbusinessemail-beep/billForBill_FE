import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

export const signedInGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.loadLoggedInUserInfo().pipe(
    map(() => true),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.loadLoggedInUserInfo().pipe(
    map((user) => user.isAdmin === true ? true : router.createUrlTree(['/dashboard'])),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};

export const adminOrSuperAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.loadLoggedInUserInfo().pipe(
    map((user) => user.isAdmin === true || user.isSuperAdmin === true ? true : router.createUrlTree(['/dashboard'])),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};

export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.loadLoggedInUserInfo().pipe(
    map((user) => user.isSuperAdmin === true ? true : router.createUrlTree(['/dashboard'])),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';
import { UserDoc, UserRole } from '@app/auth/auth.types';

const readRole = async (auth: Auth, firestore: Firestore): Promise<UserRole | null> => {
  const user = await firstValueFrom(authState(auth));
  if (!user) return null;
  try {
    const snap = await getDoc(doc(firestore, 'users', user.uid));
    return snap.exists() ? (snap.data() as UserDoc).role ?? null : null;
  } catch {
    return null;
  }
};

export const requireRole = (required: UserRole): CanActivateFn => async () => {
  const router = inject(Router);
  const auth = inject(Auth);
  const firestore = inject(Firestore);

  const user = await firstValueFrom(authState(auth));
  if (!user) return router.parseUrl('/login');

  const role = await readRole(auth, firestore);
  if (role === required) return true;
  if (role === 'admin') return router.parseUrl('/admin');
  if (role === 'employee') return router.parseUrl('/employee');
  if (role === 'parent') return router.parseUrl('/parent');
  return router.parseUrl('/login');
};

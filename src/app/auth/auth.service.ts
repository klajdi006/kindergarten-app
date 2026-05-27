import { Injectable, Injector, computed, inject, runInInjectionContext, signal } from '@angular/core';
import {
  Auth,
  authState,
  createUserWithEmailAndPassword,
  isSignInWithEmailLink,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signOut,
  updatePassword,
  updateProfile,
} from '@angular/fire/auth';
import {
  Firestore,
  addDoc,
  collection,
  deleteDoc,
  doc,
  docData,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Observable,
  catchError,
  combineLatest,
  map,
  of,
  shareReplay,
  switchMap,
} from 'rxjs';
import { AppUser, PendingAdminSignup, UserDoc, UserRole } from '@app/auth/auth.types';
import { DEFAULT_OPERATING_HOURS } from '@app/data/schedule';
import { StorageService } from '@app/shared/services/storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly functions = inject(Functions);
  private readonly injector = inject(Injector);
  private readonly storage = inject(StorageService);

  // ----- core observables -----
  readonly firebaseUser$ = authState(this.auth).pipe(
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly userDoc$: Observable<UserDoc | null> = this.firebaseUser$.pipe(
    switchMap((user) => {
      if (!user) return of<UserDoc | null>(null);
      return (
        docData(doc(this.firestore, 'users', user.uid)) as Observable<UserDoc | undefined>
      ).pipe(
        map((d) => d ?? null),
        catchError((err) => {
          console.warn('[auth] could not read user profile:', err);
          return of<UserDoc | null>(null);
        }),
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly role$: Observable<UserRole | null> = this.userDoc$.pipe(
    map((d) => d?.role ?? null),
  );

  readonly isAuthenticated$ = this.firebaseUser$.pipe(map((u) => !!u));

  readonly currentUser$: Observable<AppUser | null> = combineLatest([
    this.firebaseUser$,
    this.userDoc$,
  ]).pipe(
    map(([fbUser, profile]) => {
      if (!fbUser) return null;
      return {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName ?? profile?.displayName ?? null,
        role: profile?.role ?? null,
      };
    }),
  );

  // ----- signal mirrors -----
  private readonly firebaseUser = toSignal(this.firebaseUser$);
  private readonly userDoc = toSignal(this.userDoc$, {
    initialValue: null as UserDoc | null,
  });
  private readonly loading = signal<boolean>(false);
  private readonly error = signal<string | null>(null);

  readonly isInitializing = computed(() => this.firebaseUser() === undefined);
  readonly isLoading = this.loading.asReadonly();
  readonly errorMessage = this.error.asReadonly();
  readonly isAuthenticated = computed(() => !!this.firebaseUser());

  readonly currentUser = computed<AppUser | null>(() => {
    const fbUser = this.firebaseUser();
    if (!fbUser) return null;
    const profile = this.userDoc();
    return {
      uid: fbUser.uid,
      email: fbUser.email,
      displayName: fbUser.displayName ?? profile?.displayName ?? null,
      role: profile?.role ?? null,
    };
  });

  readonly role = computed<UserRole | null>(() => this.userDoc()?.role ?? null);
  readonly isAdmin = computed(() => this.role() === 'admin');
  readonly isParent = computed(() => this.role() === 'parent');
  readonly isEmployee = computed(() => this.role() === 'employee');
  readonly kindergartenId = computed(() => this.userDoc()?.kindergartenId ?? null);
  readonly staffRecordId = computed(() => this.userDoc()?.staffRecordId ?? null);

  // ----- sign in / out -----
  async signIn(email: string, password: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await signInWithEmailAndPassword(this.auth, email, password);
    } catch (err) {
      const message = this.toFriendlyError(err);
      this.error.set(message);
      throw new Error(message);
    } finally {
      this.loading.set(false);
    }
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
    this.storage.clearExceptPreferences();
    // Hard-reload into /login so every root singleton (data services + their
    // cached signals from this session) is torn down. A SPA navigation would
    // leave the previous user's state in memory until a manual refresh.
    window.location.assign('/login');
  }

  /**
   * First step of admin sign-up. No account is created yet — this calls the
   * requestAdminSignup function, which stores a pending signup and emails a
   * claim link. The kindergarten + admin record are only created once the
   * person proves the email via {@link finalizeAdminSignup} on the /claim page.
   */
  async requestAdminSignup(input: {
    email: string;
    displayName: string;
    kindergartenName: string;
    address: string;
  }): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const lang = localStorage.getItem('kg.lang') === 'al' ? 'al' : 'en';
      await runInInjectionContext(this.injector, () => {
        const call = httpsCallable<
          {
            email: string;
            displayName: string;
            kindergartenName: string;
            address: string;
            lang: string;
            origin: string;
          },
          { ok: boolean }
        >(this.functions, 'requestAdminSignup');
        return call({
          email: input.email.trim().toLowerCase(),
          displayName: input.displayName.trim(),
          kindergartenName: input.kindergartenName.trim(),
          address: input.address.trim(),
          lang,
          origin: window.location.origin,
        });
      });
    } catch (err) {
      const message = (err as Error)?.message || this.toFriendlyError(err);
      this.error.set(message);
      throw new Error(message);
    } finally {
      this.loading.set(false);
    }
  }

  /** Look up the pending admin signup for an email (post email-link sign-in). */
  async findPendingAdminSignup(email: string): Promise<PendingAdminSignup | null> {
    const snap = await getDocs(
      query(
        collection(this.firestore, 'pendingAdminSignups'),
        where('email', '==', email.trim().toLowerCase()),
      ),
    );
    const d = snap.docs[0];
    return d ? ({ id: d.id, ...(d.data() as Omit<PendingAdminSignup, 'id'>) }) : null;
  }

  /**
   * Completes admin sign-up after the claim link sign-in: sets the password and
   * creates the kindergarten + self admin staff record + /users profile, then
   * removes the pending signup. The caller must already be signed in via link.
   */
  async finalizeAdminSignup(password: string, pending: PendingAdminSignup): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not signed in');
    this.loading.set(true);
    this.error.set(null);
    try {
      const uid = user.uid;
      const now = Date.now();
      const displayName = pending.displayName.trim();
      if (displayName) await updateProfile(user, { displayName });
      if (password) await updatePassword(user, password);

      const kgRef = await addDoc(collection(this.firestore, 'kindergartens'), {
        name: pending.kindergartenName.trim() || `${displayName}'s kindergarten`,
        address: pending.address.trim() || null,
        operatingHours: DEFAULT_OPERATING_HOURS,
        createdByUid: uid,
        createdAt: now,
      });

      const staffRef = await addDoc(collection(this.firestore, 'staff'), {
        firstName: displayName.split(' ').slice(0, -1).join(' ') || displayName,
        lastName: displayName.split(' ').slice(-1).join(' ') || '',
        email: user.email ?? pending.email,
        phone: null,
        role: 'admin',
        departmentIds: [],
        allDepartments: true,
        kindergartenId: kgRef.id,
        claimedByUid: uid,
        createdAt: now,
      });

      const profile: UserDoc = {
        email: user.email ?? pending.email,
        displayName: displayName || null,
        role: 'admin',
        kindergartenId: kgRef.id,
        staffRecordId: staffRef.id,
        createdAt: now,
      };
      await setDoc(doc(this.firestore, 'users', uid), profile);
      await deleteDoc(doc(this.firestore, 'pendingAdminSignups', pending.id));
    } catch (err) {
      console.error('[auth] finalizeAdminSignup failed:', err);
      const message = this.toFriendlyError(err);
      this.error.set(message);
      throw new Error(message);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Manual-mode parent claim: creates the auth user and writes the parent profile.
   * Used when the parent navigates to /claim directly (not via email link).
   */
  async createParentAccount(
    email: string,
    password: string,
    displayName: string,
    kindergartenId: string,
  ): Promise<string> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const cred = await createUserWithEmailAndPassword(this.auth, email, password);
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }
      const profile: UserDoc = {
        email: cred.user.email ?? email,
        displayName: displayName || null,
        role: 'parent',
        kindergartenId,
        staffRecordId: null,
        createdAt: Date.now(),
      };
      await setDoc(doc(this.firestore, 'users', cred.user.uid), profile);
      return cred.user.uid;
    } catch (err) {
      const message = this.toFriendlyError(err);
      this.error.set(message);
      throw new Error(message);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Manual-mode staff claim: creates the auth user and writes the staff profile.
   */
  async createStaffAccount(
    email: string,
    password: string,
    displayName: string,
    role: 'admin' | 'employee',
    kindergartenId: string,
    staffRecordId: string,
  ): Promise<string> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const cred = await createUserWithEmailAndPassword(this.auth, email, password);
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }
      const profile: UserDoc = {
        email: cred.user.email ?? email,
        displayName: displayName || null,
        role,
        kindergartenId,
        staffRecordId,
        createdAt: Date.now(),
      };
      await setDoc(doc(this.firestore, 'users', cred.user.uid), profile);
      return cred.user.uid;
    } catch (err) {
      const message = this.toFriendlyError(err);
      this.error.set(message);
      throw new Error(message);
    } finally {
      this.loading.set(false);
    }
  }

  async updateUserProfile(updates: { displayName?: string }): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const user = this.firebaseUser();
      if (!user) throw new Error('Not signed in');

      if (updates.displayName !== undefined) {
        await updateProfile(user, { displayName: updates.displayName });
      }

      const patch: Record<string, unknown> = {};
      if (updates.displayName !== undefined) patch['displayName'] = updates.displayName;
      if (Object.keys(patch).length > 0) {
        await updateDoc(doc(this.firestore, 'users', user.uid), patch);
      }
    } catch (err) {
      const message = this.toFriendlyError(err);
      this.error.set(message);
      throw new Error(message);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Send a branded passwordless claim invite. Delegates to the sendClaimInvite
   * Cloud Function, which generates the /claim sign-in link server-side and
   * emails it via the Trigger Email extension (the built-in Firebase email-link
   * template can't be customized). Used for both parent and staff invites — the
   * /claim page detects which kind of record the email belongs to.
   */
  async sendInviteEmail(email: string): Promise<void> {
    const trimmed = email.trim().toLowerCase();
    const lang = localStorage.getItem('kg.lang') === 'al' ? 'al' : 'en';
    await runInInjectionContext(this.injector, () => {
      const call = httpsCallable<
        { email: string; lang: string; origin: string },
        { ok: boolean }
      >(this.functions, 'sendClaimInvite');
      return call({ email: trimmed, lang, origin: window.location.origin });
    });
  }

  isEmailLinkUrl(url: string): boolean {
    return isSignInWithEmailLink(this.auth, url);
  }

  /**
   * Step 1 of the email-link claim: sign in via the link. After this resolves,
   * Firestore reads/writes that depend on request.auth are allowed.
   */
  async signInWithLink(email: string, url: string): Promise<string> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const cred = await signInWithEmailLink(this.auth, email.trim().toLowerCase(), url);
      return cred.user.uid;
    } catch (err) {
      console.error('[auth] signInWithLink failed:', err);
      const message = this.toFriendlyError(err);
      this.error.set(message);
      throw new Error(message);
    } finally {
      this.loading.set(false);
    }
  }

  async finalizeParentProfile(
    password: string,
    displayName: string,
    kindergartenId: string,
  ): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not signed in');
    this.loading.set(true);
    this.error.set(null);
    try {
      if (displayName) await updateProfile(user, { displayName });
      if (password) await updatePassword(user, password);
      const profile: UserDoc = {
        email: user.email ?? '',
        displayName: displayName || null,
        role: 'parent',
        kindergartenId,
        staffRecordId: null,
        createdAt: Date.now(),
      };
      await setDoc(doc(this.firestore, 'users', user.uid), profile);
    } catch (err) {
      console.error('[auth] finalizeParentProfile failed:', err);
      const message = this.toFriendlyError(err);
      this.error.set(message);
      throw new Error(message);
    } finally {
      this.loading.set(false);
    }
  }

  async finalizeStaffProfile(
    password: string,
    displayName: string,
    role: 'admin' | 'employee',
    kindergartenId: string,
    staffRecordId: string,
  ): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not signed in');
    this.loading.set(true);
    this.error.set(null);
    try {
      if (displayName) await updateProfile(user, { displayName });
      if (password) await updatePassword(user, password);
      const profile: UserDoc = {
        email: user.email ?? '',
        displayName: displayName || null,
        role,
        kindergartenId,
        staffRecordId,
        createdAt: Date.now(),
      };
      await setDoc(doc(this.firestore, 'users', user.uid), profile);
    } catch (err) {
      console.error('[auth] finalizeStaffProfile failed:', err);
      const message = this.toFriendlyError(err);
      this.error.set(message);
      throw new Error(message);
    } finally {
      this.loading.set(false);
    }
  }

  clearError(): void {
    this.error.set(null);
  }

  private toFriendlyError(err: unknown): string {
    const code = (err as { code?: string })?.code ?? '';
    switch (code) {
      case 'auth/invalid-email':
        return 'auth.errors.invalidEmail';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'auth.errors.wrongCredentials';
      case 'auth/email-already-in-use':
        return 'auth.errors.emailInUse';
      case 'auth/weak-password':
        return 'auth.errors.weakPassword';
      case 'auth/network-request-failed':
        return 'auth.errors.network';
      case 'auth/invalid-action-code':
      case 'auth/expired-action-code':
        return 'auth.errors.invalidLink';
      case 'auth/operation-not-allowed':
        return 'auth.errors.linkSignInDisabled';
      case 'auth/requires-recent-login':
        return 'auth.errors.recentLoginRequired';
      default:
        return 'auth.errors.generic';
    }
  }
}

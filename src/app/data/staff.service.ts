import { Injectable, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  Firestore,
  addDoc,
  arrayUnion,
  collection,
  collectionData,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, map, of, switchMap } from 'rxjs';
import { AuthService } from '@app/auth/auth.service';
import { Staff, StaffRole } from '@app/data/types';

export interface StaffInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: StaffRole;
  departmentIds: string[];
  allDepartments: boolean;
}

@Injectable({ providedIn: 'root' })
export class StaffService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  private readonly kgId = computed(() => this.auth.kindergartenId());
  private readonly uid = computed(() => this.auth.currentUser()?.uid ?? null);

  readonly all = toSignal(
    toObservable(this.kgId).pipe(
      switchMap((kgId) => {
        if (!kgId) return of<Staff[]>([]);
        const q = query(
          collection(this.firestore, 'staff'),
          where('kindergartenId', '==', kgId),
          orderBy('lastName'),
          orderBy('firstName'),
        );
        return collectionData(q, { idField: 'id' }) as Observable<Staff[]>;
      }),
    ),
    { initialValue: [] as Staff[] },
  );

  readonly admins = computed(() => this.all().filter((s) => s.role === 'admin'));
  readonly employees = computed(() => this.all().filter((s) => s.role === 'employee'));
  readonly count = computed(() => this.all().length);

  /**
   * The signed-in user's own staff record (matched by claimedByUid == uid).
   * Used by employees / admins to read their own department access.
   */
  readonly currentStaff = toSignal(
    toObservable(this.uid).pipe(
      switchMap((uid) => {
        if (!uid) return of<Staff | null>(null);
        const q = query(
          collection(this.firestore, 'staff'),
          where('claimedByUid', '==', uid),
        );
        return (collectionData(q, { idField: 'id' }) as Observable<Staff[]>).pipe(
          map((docs) => (docs.length > 0 ? docs[0] : null)),
        );
      }),
    ),
    { initialValue: null as Staff | null },
  );

  byId(id: string) {
    return computed(() => this.all().find((s) => s.id === id) ?? null);
  }

  async add(input: StaffInput): Promise<string> {
    const kgId = this.kgId();
    if (!kgId) throw new Error('No kindergarten');
    const ref = await addDoc(collection(this.firestore, 'staff'), {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim() || null,
      role: input.role,
      departmentIds: input.role === 'admin' ? [] : input.departmentIds,
      allDepartments: input.role === 'admin' ? true : input.allDepartments,
      kindergartenId: kgId,
      claimedByUid: null,
      createdAt: Date.now(),
    });
    return ref.id;
  }

  async update(id: string, input: StaffInput): Promise<void> {
    await updateDoc(doc(this.firestore, 'staff', id), {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim() || null,
      role: input.role,
      departmentIds: input.role === 'admin' ? [] : input.departmentIds,
      allDepartments: input.role === 'admin' ? true : input.allDepartments,
    });
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'staff', id));
  }

  async findByEmail(email: string): Promise<Staff | null> {
    const q = query(
      collection(this.firestore, 'staff'),
      where('email', '==', email.trim().toLowerCase()),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...(d.data() as Omit<Staff, 'id'>) };
  }

  async findUnclaimedByEmail(email: string): Promise<Staff | null> {
    const q = query(
      collection(this.firestore, 'staff'),
      where('email', '==', email.trim().toLowerCase()),
      where('claimedByUid', '==', null),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...(d.data() as Omit<Staff, 'id'>) };
  }

  async markClaimed(staffId: string, uid: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'staff', staffId), { claimedByUid: uid });
  }

  async markPostsSeen(): Promise<void> {
    const me = this.currentStaff();
    if (!me) return;
    await updateDoc(doc(this.firestore, 'staff', me.id), {
      lastSeenPostsAt: Date.now(),
    });
  }

  async markPostSeen(postId: string): Promise<void> {
    const me = this.currentStaff();
    if (!me) return;
    if (me.seenPostIds?.includes(postId)) return;
    try {
      await updateDoc(doc(this.firestore, 'staff', me.id), {
        seenPostIds: arrayUnion(postId),
      });
    } catch (err) {
      console.warn('[staff] markPostSeen failed', err);
    }
  }

  async markSickSeen(): Promise<void> {
    const me = this.currentStaff();
    if (!me) return;
    await updateDoc(doc(this.firestore, 'staff', me.id), {
      lastSeenSickAt: Date.now(),
    });
  }
}

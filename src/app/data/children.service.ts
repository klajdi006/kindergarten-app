import { Injectable, Injector, computed, inject, runInInjectionContext } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  Firestore,
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  collectionData,
  deleteDoc,
  doc,
  orderBy,
  query,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, catchError, of, switchMap } from 'rxjs';
import { AuthService } from '@app/auth/auth.service';
import { Child, ChildGender, Staff } from '@app/data/types';

@Injectable({ providedIn: 'root' })
export class ChildrenService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);

  private readonly kgId = computed(() => this.auth.kindergartenId());

  /** Staff-side: all children in the current kindergarten. Parents never use this. */
  readonly all = toSignal(
    toObservable(computed(() => (this.auth.role() === 'parent' ? null : this.kgId()))).pipe(
      switchMap((kgId) => {
        if (!kgId) return of<Child[]>([]);
        return runInInjectionContext(this.injector, () => {
          const q = query(
            collection(this.firestore, 'children'),
            where('kindergartenId', '==', kgId),
            orderBy('lastName'),
            orderBy('firstName'),
          );
          return (collectionData(q, { idField: 'id' }) as Observable<Child[]>).pipe(
            catchError((err) => {
              console.warn('children.all listener denied', err);
              return of<Child[]>([]);
            }),
          );
        });
      }),
    ),
    { initialValue: [] as Child[] },
  );

  readonly count = computed(() => this.all().length);

  byId(id: string) {
    return computed(() => this.all().find((c) => c.id === id) ?? null);
  }

  byParent(parentId: string) {
    return computed(() => this.all().filter((c) => c.parentIds.includes(parentId)));
  }

  async add(input: {
    firstName: string;
    lastName: string;
    birthDate: string;
    gender: ChildGender;
    departmentId: string | null;
    tariff: number;
  }): Promise<void> {
    const kgId = this.kgId();
    if (!kgId) throw new Error('No kindergarten');
    await addDoc(collection(this.firestore, 'children'), {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      birthDate: input.birthDate,
      gender: input.gender,
      departmentId: input.departmentId,
      parentIds: [],
      kindergartenId: kgId,
      tariff: input.tariff,
      createdAt: Date.now(),
    });
  }

  async update(
    id: string,
    input: {
      firstName: string;
      lastName: string;
      birthDate: string;
      gender: ChildGender;
      departmentId: string | null;
      tariff: number;
    },
  ): Promise<void> {
    await updateDoc(doc(this.firestore, 'children', id), {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      birthDate: input.birthDate,
      gender: input.gender,
      departmentId: input.departmentId,
      tariff: input.tariff,
    });
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'children', id));
  }

  forParent(parentId: string): Observable<Child[]> {
    return runInInjectionContext(this.injector, () => {
      const kgId = this.auth.kindergartenId();
      if (!kgId) return of<Child[]>([]);
      const q = query(
        collection(this.firestore, 'children'),
        where('kindergartenId', '==', kgId),
        where('parentIds', 'array-contains', parentId),
      );
      return (collectionData(q, { idField: 'id' }) as Observable<Child[]>).pipe(
        catchError((err) => {
          console.warn('children.forParent listener denied', err);
          return of<Child[]>([]);
        }),
      );
    });
  }

  /**
   * Employee-side: children scoped to a staff member's accessible departments.
   * If `allDepartments`, returns every child in the kindergarten. Otherwise
   * uses an `in` query on `departmentId` (Firestore limit: 30 values).
   */
  forStaff(staff: Staff): Observable<Child[]> {
    return runInInjectionContext(this.injector, () => {
      if (staff.allDepartments) {
        const q = query(
          collection(this.firestore, 'children'),
          where('kindergartenId', '==', staff.kindergartenId),
        );
        return collectionData(q, { idField: 'id' }) as Observable<Child[]>;
      }
      if (staff.departmentIds.length === 0) return of<Child[]>([]);
      const q = query(
        collection(this.firestore, 'children'),
        where('kindergartenId', '==', staff.kindergartenId),
        where('departmentId', 'in', staff.departmentIds),
      );
      return collectionData(q, { idField: 'id' }) as Observable<Child[]>;
    });
  }

  async linkParent(childId: string, parentId: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'children', childId), {
      parentIds: arrayUnion(parentId),
    });
  }

  async unlinkParent(childId: string, parentId: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'children', childId), {
      parentIds: arrayRemove(parentId),
    });
  }
}

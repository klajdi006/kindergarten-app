import { Injectable, Injector, computed, inject, runInInjectionContext } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  orderBy,
  query,
  where,
} from '@angular/fire/firestore';
import { Observable, catchError, of, switchMap } from 'rxjs';
import { AuthService } from '@app/auth/auth.service';
import { Absence, AbsenceType } from '@app/data/types';

@Injectable({ providedIn: 'root' })
export class AbsencesService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);

  private readonly kgId = computed(() => this.auth.kindergartenId());

  /** Staff-side: all absences in the current kindergarten. Parents never use this. */
  readonly all = toSignal(
    toObservable(computed(() => (this.auth.role() === 'parent' ? null : this.kgId()))).pipe(
      switchMap((kgId) => {
        if (!kgId) return of<Absence[]>([]);
        const q = query(
          collection(this.firestore, 'absences'),
          where('kindergartenId', '==', kgId),
          orderBy('startDate', 'desc'),
        );
        return (collectionData(q, { idField: 'id' }) as Observable<Absence[]>).pipe(
          catchError((err) => {
            console.warn('absences.all listener denied', err);
            return of<Absence[]>([]);
          }),
        );
      }),
    ),
    { initialValue: [] as Absence[] },
  );

  forChild(childId: string): Observable<Absence[]> {
    return runInInjectionContext(this.injector, () => {
      const kgId = this.auth.kindergartenId();
      if (!kgId) return of<Absence[]>([]);
      const q = query(
        collection(this.firestore, 'absences'),
        where('kindergartenId', '==', kgId),
        where('childId', '==', childId),
        orderBy('startDate', 'desc'),
      );
      return (collectionData(q, { idField: 'id' }) as Observable<Absence[]>).pipe(
        catchError((err) => {
          console.warn('absences.forChild listener denied', err);
          return of<Absence[]>([]);
        }),
      );
    });
  }

  async add(input: {
    childId: string;
    kindergartenId: string;
    type: AbsenceType;
    startDate: string;
    endDate: string;
    note: string;
  }): Promise<void> {
    const uid = this.auth.currentUser()?.uid;
    if (!uid) throw new Error('Not signed in');
    await addDoc(collection(this.firestore, 'absences'), {
      childId: input.childId,
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      note: input.note.trim() || null,
      kindergartenId: input.kindergartenId,
      createdByUid: uid,
      createdAt: Date.now(),
    });
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'absences', id));
  }
}

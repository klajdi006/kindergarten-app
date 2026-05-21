import { Injectable, computed, inject } from '@angular/core';
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
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, of, switchMap } from 'rxjs';
import { AuthService } from '@app/auth/auth.service';
import { Department } from '@app/data/types';

@Injectable({ providedIn: 'root' })
export class DepartmentsService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  private readonly kgId = computed(() => this.auth.kindergartenId());

  readonly all = toSignal(
    toObservable(this.kgId).pipe(
      switchMap((kgId) => {
        if (!kgId) return of<Department[]>([]);
        const q = query(
          collection(this.firestore, 'departments'),
          where('kindergartenId', '==', kgId),
          orderBy('name'),
        );
        return collectionData(q, { idField: 'id' }) as Observable<Department[]>;
      }),
    ),
    { initialValue: [] as Department[] },
  );

  readonly count = computed(() => this.all().length);

  forKindergarten(kgId: string): Observable<Department[]> {
    const q = query(
      collection(this.firestore, 'departments'),
      where('kindergartenId', '==', kgId),
      orderBy('name'),
    );
    return collectionData(q, { idField: 'id' }) as Observable<Department[]>;
  }

  async add(input: { name: string; ageMin: number; ageMax: number }): Promise<void> {
    const kgId = this.kgId();
    if (!kgId) throw new Error('No kindergarten');
    await addDoc(collection(this.firestore, 'departments'), {
      name: input.name.trim(),
      ageMin: input.ageMin,
      ageMax: input.ageMax,
      kindergartenId: kgId,
      createdAt: Date.now(),
    });
  }

  async update(id: string, input: { name: string; ageMin: number; ageMax: number }): Promise<void> {
    await updateDoc(doc(this.firestore, 'departments', id), {
      name: input.name.trim(),
      ageMin: input.ageMin,
      ageMax: input.ageMax,
    });
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'departments', id));
  }
}

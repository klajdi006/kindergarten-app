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
import { Post } from '@app/data/types';

@Injectable({ providedIn: 'root' })
export class PostsService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  private readonly uid = computed(() => this.auth.currentUser()?.uid ?? null);
  private readonly kgId = computed(() => this.auth.kindergartenId());

  readonly all$ = toObservable(this.kgId).pipe(
    switchMap((kgId) => {
      if (!kgId) return of<Post[]>([]);
      const q = query(
        collection(this.firestore, 'posts'),
        where('kindergartenId', '==', kgId),
        orderBy('createdAt', 'desc'),
      );
      return collectionData(q, { idField: 'id' }) as Observable<Post[]>;
    }),
  );

  readonly all = toSignal(this.all$, { initialValue: [] as Post[] });
  readonly count = computed(() => this.all().length);

  byId(id: string) {
    return computed(() => this.all().find((p) => p.id === id) ?? null);
  }

  forKindergarten(kgId: string): Observable<Post[]> {
    const q = query(
      collection(this.firestore, 'posts'),
      where('kindergartenId', '==', kgId),
      orderBy('createdAt', 'desc'),
    );
    return collectionData(q, { idField: 'id' }) as Observable<Post[]>;
  }

  async add(input: {
    title: string;
    description: string;
    departmentId: string | null;
    authorName: string | null;
  }): Promise<void> {
    const uid = this.uid();
    const kgId = this.kgId();
    if (!uid || !kgId) throw new Error('Not signed in');
    const now = Date.now();
    await addDoc(collection(this.firestore, 'posts'), {
      title: input.title.trim(),
      description: input.description.trim(),
      departmentId: input.departmentId,
      imageUrls: [],
      kindergartenId: kgId,
      authorUid: uid,
      authorName: input.authorName?.trim() || null,
      createdAt: now,
      updatedAt: now,
    });
  }

  async update(
    id: string,
    input: { title: string; description: string; departmentId: string | null },
  ): Promise<void> {
    await updateDoc(doc(this.firestore, 'posts', id), {
      title: input.title.trim(),
      description: input.description.trim(),
      departmentId: input.departmentId,
      updatedAt: Date.now(),
    });
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'posts', id));
  }
}

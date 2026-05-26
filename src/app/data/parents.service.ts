import { Injectable, computed, inject } from '@angular/core';
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
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, of, switchMap, map } from 'rxjs';
import { AuthService } from '@app/auth/auth.service';
import { ChildrenService } from '@app/data/children.service';
import { Parent } from '@app/data/types';

@Injectable({ providedIn: 'root' })
export class ParentsService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly childrenService = inject(ChildrenService);

  private readonly uid = computed(() => this.auth.currentUser()?.uid ?? null);
  private readonly kgId = computed(() => this.auth.kindergartenId());

  readonly all = toSignal(
    toObservable(this.kgId).pipe(
      switchMap((kgId) => {
        if (!kgId) return of<Parent[]>([]);
        const q = query(
          collection(this.firestore, 'parents'),
          where('kindergartenId', '==', kgId),
          orderBy('lastName'),
          orderBy('firstName'),
        );
        return collectionData(q, { idField: 'id' }) as Observable<Parent[]>;
      }),
    ),
    { initialValue: [] as Parent[] },
  );

  readonly count = computed(() => this.all().length);

  readonly currentParent = toSignal(
    toObservable(this.uid).pipe(
      switchMap((uid) => {
        if (!uid) return of<Parent | null>(null);
        const q = query(
          collection(this.firestore, 'parents'),
          where('claimedByUid', '==', uid),
        );
        return (collectionData(q, { idField: 'id' }) as Observable<Parent[]>).pipe(
          map((docs) => (docs.length > 0 ? docs[0] : null)),
        );
      }),
    ),
    { initialValue: null as Parent | null },
  );

  byId(id: string) {
    return computed(() => this.all().find((p) => p.id === id) ?? null);
  }

  async add(input: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  }): Promise<void> {
    const kgId = this.kgId();
    if (!kgId) throw new Error('No kindergarten');
    await addDoc(collection(this.firestore, 'parents'), {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim() || null,
      childIds: [],
      claimedByUid: null,
      kindergartenId: kgId,
      createdAt: Date.now(),
    });
  }

  async update(
    id: string,
    input: { firstName: string; lastName: string; email: string; phone: string },
  ): Promise<void> {
    await updateDoc(doc(this.firestore, 'parents', id), {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim() || null,
    });
  }

  async remove(id: string): Promise<void> {
    const parent = this.byId(id)();
    if (parent) {
      for (const childId of parent.childIds) {
        await this.childrenService.unlinkParent(childId, id);
      }
    }
    await deleteDoc(doc(this.firestore, 'parents', id));
  }

  async assignChild(parentId: string, childId: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'parents', parentId), {
      childIds: arrayUnion(childId),
    });
    await this.childrenService.linkParent(childId, parentId);
  }

  async unassignChild(parentId: string, childId: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'parents', parentId), {
      childIds: arrayRemove(childId),
    });
    await this.childrenService.unlinkParent(childId, parentId);
  }

  async findByEmail(email: string): Promise<Parent | null> {
    const q = query(
      collection(this.firestore, 'parents'),
      where('email', '==', email.trim().toLowerCase()),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...(d.data() as Omit<Parent, 'id'>) };
  }

  async findUnclaimedByEmail(email: string): Promise<Parent | null> {
    const q = query(
      collection(this.firestore, 'parents'),
      where('email', '==', email.trim().toLowerCase()),
      where('claimedByUid', '==', null),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...(d.data() as Omit<Parent, 'id'>) };
  }

  async markClaimed(parentId: string, uid: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'parents', parentId), { claimedByUid: uid });
  }

  async markPostsSeen(): Promise<void> {
    const me = this.currentParent();
    if (!me) return;
    await updateDoc(doc(this.firestore, 'parents', me.id), {
      lastSeenPostsAt: Date.now(),
    });
  }

  async markPostSeen(postId: string): Promise<void> {
    const me = this.currentParent();
    if (!me) return;
    if (me.seenPostIds?.includes(postId)) return;
    try {
      await updateDoc(doc(this.firestore, 'parents', me.id), {
        seenPostIds: arrayUnion(postId),
      });
    } catch (err) {
      console.warn('[parents] markPostSeen failed', err);
    }
  }
}

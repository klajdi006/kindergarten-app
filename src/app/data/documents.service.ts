import { Injectable, Injector, computed, inject, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import {
  Storage,
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from '@angular/fire/storage';
import { Observable, of } from 'rxjs';
import { AuthService } from '@app/auth/auth.service';
import { ChildDocument, Child, Parent } from '@app/data/types';

@Injectable({ providedIn: 'root' })
export class DocumentsService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);
  private readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);

  private readonly uid = computed(() => this.auth.currentUser()?.uid ?? null);
  private readonly kgId = computed(() => this.auth.kindergartenId());

  /**
   * Documents for a child. Admins query by kindergarten; parents query by the
   * allowedParentUids array-contains their uid (so the query matches the read
   * rule and Firestore doesn't reject it).
   */
  forChild(childId: string): Observable<ChildDocument[]> {
    const kgId = this.kgId();
    const uid = this.uid();
    if (!kgId || !uid) return of<ChildDocument[]>([]);
    return runInInjectionContext(this.injector, () => {
      const col = collection(this.firestore, 'documents');
      const q =
        this.auth.role() === 'admin'
          ? query(
              col,
              where('childId', '==', childId),
              where('kindergartenId', '==', kgId),
              orderBy('uploadedAt', 'desc'),
            )
          : query(
              col,
              where('childId', '==', childId),
              where('allowedParentUids', 'array-contains', uid),
              orderBy('uploadedAt', 'desc'),
            );
      return collectionData(q, { idField: 'id' }) as Observable<ChildDocument[]>;
    });
  }

  /** Auth uids of the child's claimed parents (those who can sign in). */
  private allowedUidsFor(child: Child, parents: Parent[]): string[] {
    const byId = new Map(parents.map((p) => [p.id, p]));
    return child.parentIds
      .map((pid) => byId.get(pid)?.claimedByUid)
      .filter((u): u is string => !!u);
  }

  async upload(
    child: Child,
    parents: Parent[],
    file: File,
    onProgress?: (fraction: number) => void,
  ): Promise<void> {
    const uid = this.uid();
    const kgId = this.kgId();
    if (!uid || !kgId) throw new Error('Not signed in');

    const ext = file.name.split('.').pop()?.toLowerCase();
    const fileId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const path = `documents/${kgId}/${child.id}/${fileId}${ext ? '.' + ext : ''}`;
    const task = uploadBytesResumable(ref(this.storage, path), file, {
      contentType: file.type || undefined,
    });

    const url = await new Promise<string>((resolve, reject) => {
      task.on(
        'state_changed',
        (s) => s.totalBytes > 0 && onProgress?.(s.bytesTransferred / s.totalBytes),
        reject,
        () => getDownloadURL(task.snapshot.ref).then(resolve, reject),
      );
    });

    await addDoc(collection(this.firestore, 'documents'), {
      childId: child.id,
      kindergartenId: kgId,
      name: file.name,
      url,
      path,
      allowedParentUids: this.allowedUidsFor(child, parents),
      uploadedByUid: uid,
      uploadedAt: Date.now(),
    });
  }

  async remove(document: ChildDocument): Promise<void> {
    try {
      await deleteObject(ref(this.storage, document.path));
    } catch (err) {
      console.warn('[documents] storage delete failed (non-fatal)', err);
    }
    await deleteDoc(doc(this.firestore, 'documents', document.id));
  }

  /**
   * Recompute allowedParentUids for every document of a child. Call after the
   * child's parent links change so access stays correct (new parents gain
   * access, removed parents lose it). Re-reads the child doc fresh so it's not
   * affected by stale local signals right after a link write.
   */
  async refreshAccessForChild(childId: string, parents: Parent[]): Promise<void> {
    const kgId = this.kgId();
    if (!kgId) return;
    const childSnap = await getDoc(doc(this.firestore, 'children', childId));
    if (!childSnap.exists()) return;
    const child = { id: childSnap.id, ...(childSnap.data() as Omit<Child, 'id'>) };
    const allowed = this.allowedUidsFor(child, parents);
    const snap = await getDocs(
      query(
        collection(this.firestore, 'documents'),
        where('childId', '==', childId),
        where('kindergartenId', '==', kgId),
      ),
    );
    await Promise.all(
      snap.docs.map((d) =>
        updateDoc(doc(this.firestore, 'documents', d.id), { allowedParentUids: allowed }),
      ),
    );
  }
}

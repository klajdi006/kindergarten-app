import { Injectable, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  increment,
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
  uploadBytes,
} from '@angular/fire/storage';
import { Observable, of, switchMap } from 'rxjs';
import { AuthService } from '@app/auth/auth.service';
import { Album, Photo } from '@app/data/types';

@Injectable({ providedIn: 'root' })
export class AlbumsService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);
  private readonly auth = inject(AuthService);

  private readonly uid = computed(() => this.auth.currentUser()?.uid ?? null);
  private readonly kgId = computed(() => this.auth.kindergartenId());

  readonly all$ = toObservable(this.kgId).pipe(
    switchMap((kgId) => {
      if (!kgId) return of<Album[]>([]);
      const q = query(
        collection(this.firestore, 'albums'),
        where('kindergartenId', '==', kgId),
        orderBy('createdAt', 'desc'),
      );
      return collectionData(q, { idField: 'id' }) as Observable<Album[]>;
    }),
  );

  readonly all = toSignal(this.all$, { initialValue: [] as Album[] });
  readonly count = computed(() => this.all().length);

  byId(id: string) {
    return computed(() => this.all().find((a) => a.id === id) ?? null);
  }

  byDepartment(departmentId: string) {
    return computed(() => this.all().filter((a) => a.departmentId === departmentId));
  }

  photosFor(albumId: string): Observable<Photo[]> {
    const q = query(
      collection(this.firestore, 'photos'),
      where('albumId', '==', albumId),
      orderBy('uploadedAt', 'desc'),
    );
    return collectionData(q, { idField: 'id' }) as Observable<Photo[]>;
  }

  async add(input: { name: string; departmentId: string }): Promise<void> {
    const kgId = this.kgId();
    if (!kgId) throw new Error('No kindergarten');
    await addDoc(collection(this.firestore, 'albums'), {
      name: input.name.trim(),
      departmentId: input.departmentId,
      kindergartenId: kgId,
      photoCount: 0,
      createdAt: Date.now(),
    });
  }

  async update(id: string, input: { name: string; departmentId: string }): Promise<void> {
    await updateDoc(doc(this.firestore, 'albums', id), {
      name: input.name.trim(),
      departmentId: input.departmentId,
    });
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'albums', id));
  }

  async uploadPhoto(albumId: string, file: File): Promise<void> {
    const uid = this.uid();
    const kgId = this.kgId();
    if (!uid || !kgId) throw new Error('Not signed in');

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const photoId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const storagePath = `albums/${albumId}/${photoId}.${ext}`;

    const storageRef = ref(this.storage, storagePath);
    await uploadBytes(storageRef, file, { contentType: file.type || undefined });
    const downloadUrl = await getDownloadURL(storageRef);

    await addDoc(collection(this.firestore, 'photos'), {
      albumId,
      storagePath,
      downloadUrl,
      kindergartenId: kgId,
      uploadedByUid: uid,
      uploadedAt: Date.now(),
    });

    await updateDoc(doc(this.firestore, 'albums', albumId), {
      photoCount: increment(1),
    });
  }

  async removePhoto(photo: Photo): Promise<void> {
    try {
      await deleteObject(ref(this.storage, photo.storagePath));
    } catch (err) {
      console.warn('[albums] could not delete storage object:', err);
    }
    await deleteDoc(doc(this.firestore, 'photos', photo.id));
    await updateDoc(doc(this.firestore, 'albums', photo.albumId), {
      photoCount: increment(-1),
    });
  }
}

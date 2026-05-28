import { Injectable, Injector, computed, inject, runInInjectionContext } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  getDocs,
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
  uploadBytesResumable,
} from '@angular/fire/storage';
import { Observable, of, switchMap } from 'rxjs';
import { AuthService } from '@app/auth/auth.service';
import { Album, Photo } from '@app/data/types';

@Injectable({ providedIn: 'root' })
export class AlbumsService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);
  private readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);

  private readonly uid = computed(() => this.auth.currentUser()?.uid ?? null);
  private readonly kgId = computed(() => this.auth.kindergartenId());

  readonly all$ = toObservable(this.kgId).pipe(
    switchMap((kgId) => {
      if (!kgId) return of<Album[]>([]);
      return runInInjectionContext(this.injector, () => {
        const q = query(
          collection(this.firestore, 'albums'),
          where('kindergartenId', '==', kgId),
          orderBy('createdAt', 'desc'),
        );
        return collectionData(q, { idField: 'id' }) as Observable<Album[]>;
      });
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
    const kgId = this.kgId();
    if (!kgId) return of<Photo[]>([]);
    return runInInjectionContext(this.injector, () => {
      // The /photos read rule checks resource.data.kindergartenId, so the
      // query must constrain that field — otherwise Firestore's rules-aware
      // queries reject the listener (AngularFire then silently emits []).
      const q = query(
        collection(this.firestore, 'photos'),
        where('albumId', '==', albumId),
        where('kindergartenId', '==', kgId),
        orderBy('uploadedAt', 'desc'),
      );
      return collectionData(q, { idField: 'id' }) as Observable<Photo[]>;
    });
  }

  async add(input: { name: string; departmentId: string }): Promise<void> {
    const kgId = this.kgId();
    const uid = this.uid();
    if (!kgId || !uid) throw new Error('Not signed in');
    await addDoc(collection(this.firestore, 'albums'), {
      name: input.name.trim(),
      departmentId: input.departmentId,
      kindergartenId: kgId,
      photoCount: 0,
      createdByUid: uid,
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
    const kgId = this.kgId();
    if (!kgId) throw new Error('No kindergarten');
    // The /photos read rule is `inMyKg(resource.data.kindergartenId)`. For a
    // list query, Firestore requires the query itself to constrain that field,
    // otherwise it rejects upfront — so we filter by kindergartenId too.
    const photosSnap = await getDocs(
      query(
        collection(this.firestore, 'photos'),
        where('albumId', '==', id),
        where('kindergartenId', '==', kgId),
      ),
    );
    for (const docSnap of photosSnap.docs) {
      const data = docSnap.data() as Omit<Photo, 'id'>;
      try {
        await deleteObject(ref(this.storage, data.storagePath));
      } catch (err) {
        console.warn('[albums] storage delete failed (non-fatal)', err);
      }
      await deleteDoc(doc(this.firestore, 'photos', docSnap.id));
    }
    await deleteDoc(doc(this.firestore, 'albums', id));
  }

  /**
   * Upload one photo. `onProgress` receives the byte-transfer fraction (0..1)
   * for per-file progress UI. Resolves once the photo doc is written and the
   * album's photoCount is bumped.
   */
  uploadPhoto(
    albumId: string,
    file: File,
    onProgress?: (fraction: number) => void,
  ): Promise<string> {
    const uid = this.uid();
    const kgId = this.kgId();
    if (!uid || !kgId) return Promise.reject(new Error('Not signed in'));

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const photoId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const storagePath = `albums/${albumId}/${photoId}.${ext}`;
    const storageRef = ref(this.storage, storagePath);

    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || undefined,
    });

    return new Promise<string>((resolve, reject) => {
      task.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0) {
            onProgress?.(snapshot.bytesTransferred / snapshot.totalBytes);
          }
        },
        reject,
        async () => {
          try {
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
            onProgress?.(1);
            resolve(downloadUrl);
          } catch (err) {
            reject(err);
          }
        },
      );
    });
  }

  async removePhoto(photo: Photo): Promise<void> {
    try {
      await deleteObject(ref(this.storage, photo.storagePath));
    } catch (err) {
      console.warn('[albums] storage delete failed (non-fatal)', err);
    }
    await deleteDoc(doc(this.firestore, 'photos', photo.id));
    await updateDoc(doc(this.firestore, 'albums', photo.albumId), {
      photoCount: increment(-1),
    });
  }
}

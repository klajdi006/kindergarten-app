import { Injectable, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  limit,
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
import { Post, PostAttachment } from '@app/data/types';
import { compressImage } from '@app/shared/utils/image';

export interface PostImageUpload {
  url: string;
  path: string;
}

@Injectable({ providedIn: 'root' })
export class PostsService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);
  private readonly auth = inject(AuthService);

  private readonly uid = computed(() => this.auth.currentUser()?.uid ?? null);
  private readonly kgId = computed(() => this.auth.kindergartenId());

  /** Feeds and badge counts read the most recent posts only (bounded for cost/perf). */
  private readonly RECENT_LIMIT = 200;

  private randomId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  /** Upload a (compressed) image for a post. Resolves to its url + storage path. */
  uploadImage(file: File, onProgress?: (fraction: number) => void): Promise<PostImageUpload> {
    const kgId = this.kgId();
    if (!kgId) return Promise.reject(new Error('No kindergarten'));
    return new Promise<PostImageUpload>((resolve, reject) => {
      void compressImage(file).then((compressed) => {
        const path = `posts/${kgId}/${this.randomId()}.jpg`;
        const task = uploadBytesResumable(ref(this.storage, path), compressed, {
          contentType: compressed.type || 'image/jpeg',
        });
        task.on(
          'state_changed',
          (s) => s.totalBytes > 0 && onProgress?.(s.bytesTransferred / s.totalBytes),
          reject,
          async () => {
            try {
              const url = await getDownloadURL(task.snapshot.ref);
              onProgress?.(1);
              resolve({ url, path });
            } catch (err) {
              reject(err);
            }
          },
        );
      }, reject);
    });
  }

  /** Upload an arbitrary file attachment for a post. */
  uploadFile(file: File, onProgress?: (fraction: number) => void): Promise<PostAttachment> {
    const kgId = this.kgId();
    if (!kgId) return Promise.reject(new Error('No kindergarten'));
    const ext = file.name.split('.').pop()?.toLowerCase();
    const path = `posts/${kgId}/${this.randomId()}${ext ? '.' + ext : ''}`;
    const task = uploadBytesResumable(ref(this.storage, path), file, {
      contentType: file.type || undefined,
    });
    return new Promise<PostAttachment>((resolve, reject) => {
      task.on(
        'state_changed',
        (s) => s.totalBytes > 0 && onProgress?.(s.bytesTransferred / s.totalBytes),
        reject,
        async () => {
          try {
            const url = await getDownloadURL(task.snapshot.ref);
            onProgress?.(1);
            resolve({ name: file.name, url, path });
          } catch (err) {
            reject(err);
          }
        },
      );
    });
  }

  /** Best-effort delete of storage objects (used when removing media/posts). */
  async deleteMedia(paths: string[]): Promise<void> {
    for (const path of paths) {
      try {
        await deleteObject(ref(this.storage, path));
      } catch (err) {
        console.warn('[posts] media delete failed (non-fatal)', path, err);
      }
    }
  }

  readonly all$ = toObservable(this.kgId).pipe(
    switchMap((kgId) => {
      if (!kgId) return of<Post[]>([]);
      const q = query(
        collection(this.firestore, 'posts'),
        where('kindergartenId', '==', kgId),
        orderBy('createdAt', 'desc'),
        limit(this.RECENT_LIMIT),
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
      limit(this.RECENT_LIMIT),
    );
    return collectionData(q, { idField: 'id' }) as Observable<Post[]>;
  }

  async add(input: {
    title: string;
    description: string;
    departmentId: string | null;
    authorName: string | null;
    imageUrls?: string[];
    imagePaths?: string[];
    attachments?: PostAttachment[];
  }): Promise<void> {
    const uid = this.uid();
    const kgId = this.kgId();
    if (!uid || !kgId) throw new Error('Not signed in');
    const now = Date.now();
    await addDoc(collection(this.firestore, 'posts'), {
      title: input.title.trim(),
      description: input.description.trim(),
      departmentId: input.departmentId,
      imageUrls: input.imageUrls ?? [],
      imagePaths: input.imagePaths ?? [],
      attachments: input.attachments ?? [],
      kindergartenId: kgId,
      authorUid: uid,
      authorName: input.authorName?.trim() || null,
      createdAt: now,
      updatedAt: now,
    });
  }

  async update(
    id: string,
    input: {
      title: string;
      description: string;
      departmentId: string | null;
      imageUrls?: string[];
      imagePaths?: string[];
      attachments?: PostAttachment[];
    },
  ): Promise<void> {
    await updateDoc(doc(this.firestore, 'posts', id), {
      title: input.title.trim(),
      description: input.description.trim(),
      departmentId: input.departmentId,
      ...(input.imageUrls !== undefined ? { imageUrls: input.imageUrls } : {}),
      ...(input.imagePaths !== undefined ? { imagePaths: input.imagePaths } : {}),
      ...(input.attachments !== undefined ? { attachments: input.attachments } : {}),
      updatedAt: Date.now(),
    });
  }

  async remove(id: string): Promise<void> {
    const post = this.all().find((p) => p.id === id);
    if (post) {
      const paths = [
        ...(post.imagePaths ?? []),
        ...(post.attachments ?? []).map((a) => a.path),
      ];
      if (paths.length > 0) await this.deleteMedia(paths);
    }
    await deleteDoc(doc(this.firestore, 'posts', id));
  }
}

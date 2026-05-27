import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonSkeletonText,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  closeOutline,
  cloudUploadOutline,
  imagesOutline,
} from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map, of, startWith, switchMap } from 'rxjs';
import { AlbumsService } from '@app/data/albums.service';
import { StaffService } from '@app/data/staff.service';
import { Photo } from '@app/data/types';
import { PhotoViewerModal } from '@app/shared/components/photo-viewer/photo-viewer.modal';
import { compressImage } from '@app/shared/utils/image';

interface PendingUpload {
  id: string;
  previewUrl: string;
  progress: number;
  failed: boolean;
  /** Remote URL once the upload finishes; used to hide the duplicate real
   *  photo until its image has preloaded, avoiding a swap flicker. */
  finalUrl?: string;
}

@Component({
  selector: 'app-employee-album-detail',
  templateUrl: 'employee-album-detail.page.html',
  styleUrl: './employee-album-detail.page.scss',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonIcon,
    IonText,
    IonFab,
    IonFabButton,
    IonSkeletonText,
    TranslatePipe,
  ],
})
export class EmployeeAlbumDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly staff = inject(StaffService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly t = inject(TranslateService);
  readonly albums = inject(AlbumsService);

  /** Circumference of the SVG progress ring (r=16). */
  protected readonly RING_C = 2 * Math.PI * 16;

  readonly albumId = toSignal(
    this.route.paramMap.pipe(switchMap((p) => of(p.get('id')))),
    { initialValue: null as string | null },
  );

  readonly album = computed(() => {
    const id = this.albumId();
    return id ? this.albums.byId(id)() : null;
  });

  private readonly photosState = toSignal(
    toObservable(this.albumId).pipe(
      switchMap((id) =>
        id
          ? this.albums.photosFor(id).pipe(
              map((photos) => ({ photos, loading: false })),
              startWith({ photos: [] as Photo[], loading: true }),
            )
          : of({ photos: [] as Photo[], loading: false }),
      ),
    ),
    { initialValue: { photos: [] as Photo[], loading: true } },
  );

  readonly photos = computed(() => this.photosState().photos);
  readonly loading = computed(() => this.photosState().loading);

  protected readonly skeletonCells = Array.from({ length: 9 });

  readonly canEdit = computed(() => {
    const a = this.album();
    const s = this.staff.currentStaff();
    if (!a || !s) return false;
    return s.allDepartments || s.departmentIds.includes(a.departmentId);
  });

  readonly uploads = signal<PendingUpload[]>([]);
  readonly uploading = computed(() => this.uploads().some((u) => !u.failed));

  /**
   * Real photos to show in the grid, minus any whose remote URL is still
   * being represented by an in-flight upload cell. This prevents a brief
   * duplicate (pending preview + real photo) and the swap flicker — the real
   * photo only appears once its pending cell has preloaded and been removed.
   */
  readonly displayedPhotos = computed<Photo[]>(() => {
    const pendingUrls = new Set(
      this.uploads()
        .map((u) => u.finalUrl)
        .filter((u): u is string => !!u),
    );
    if (pendingUrls.size === 0) return this.photos();
    return this.photos().filter((p) => !pendingUrls.has(p.downloadUrl));
  });

  constructor() {
    addIcons({
      'cloud-upload-outline': cloudUploadOutline,
      'images-outline': imagesOutline,
      'close-outline': closeOutline,
      'alert-circle-outline': alertCircleOutline,
    });
    // Revoke any leftover object URLs when leaving the page.
    inject(DestroyRef).onDestroy(() => {
      for (const u of this.uploads()) URL.revokeObjectURL(u.previewUrl);
    });
  }

  /** Stroke dash offset for the ring given a 0..1 progress. */
  ringOffset(progress: number): number {
    return this.RING_C * (1 - progress);
  }

  pct(progress: number): number {
    return Math.round(progress * 100);
  }

  onFilesPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    if (files.length === 0) return;
    const id = this.albumId();
    if (!id) return;

    for (const file of files) {
      const entry: PendingUpload = {
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        failed: false,
      };
      this.uploads.update((list) => [entry, ...list]);
      void this.uploadOne(id, file, entry.id);
    }
  }

  private async uploadOne(albumId: string, file: File, entryId: string): Promise<void> {
    try {
      const toUpload = await compressImage(file);
      const downloadUrl = await this.albums.uploadPhoto(albumId, toUpload, (fraction) => {
        this.uploads.update((list) =>
          list.map((u) => (u.id === entryId ? { ...u, progress: fraction } : u)),
        );
      });
      // Keep the pending preview visible (and the duplicate real photo hidden)
      // until the remote image is decoded, then swap with no flicker.
      this.uploads.update((list) =>
        list.map((u) => (u.id === entryId ? { ...u, progress: 1, finalUrl: downloadUrl } : u)),
      );
      await this.preloadImage(downloadUrl);
      this.removeUpload(entryId);
    } catch {
      this.uploads.update((list) =>
        list.map((u) => (u.id === entryId ? { ...u, failed: true } : u)),
      );
      const toast = await this.toastCtrl.create({
        message: this.t.instant('admin.albums.uploadFailed'),
        duration: 3000,
        color: 'danger',
        position: 'bottom',
      });
      await toast.present();
    }
  }

  dismissFailed(entryId: string): void {
    this.removeUpload(entryId);
  }

  /** Resolve once the browser has the image cached/decoded (or on error). */
  private preloadImage(url: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = url;
    });
  }

  private removeUpload(entryId: string): void {
    this.uploads.update((list) => {
      const found = list.find((u) => u.id === entryId);
      if (found) URL.revokeObjectURL(found.previewUrl);
      return list.filter((u) => u.id !== entryId);
    });
  }

  async openViewer(index: number): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: PhotoViewerModal,
      componentProps: { photos: this.displayedPhotos(), startIndex: index },
    });
    await modal.present();
  }

  async confirmDeletePhoto(photo: Photo, event: Event): Promise<void> {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: this.t.instant('common.confirmDeleteTitle'),
      message: this.t.instant('admin.albums.confirmDeletePhoto'),
      buttons: [
        { text: this.t.instant('common.cancel'), role: 'cancel' },
        {
          text: this.t.instant('common.delete'),
          role: 'destructive',
          handler: async () => {
            try {
              await this.albums.removePhoto(photo);
            } catch (err) {
              console.error('[albums] removePhoto failed', err);
            }
          },
        },
      ],
    });
    await alert.present();
  }
}

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
import { of, switchMap } from 'rxjs';
import { AlbumsService } from '@app/data/albums.service';
import { StaffService } from '@app/data/staff.service';
import { Photo } from '@app/data/types';
import { PhotoViewerModal } from '@app/shared/components/photo-viewer/photo-viewer.modal';

interface PendingUpload {
  id: string;
  previewUrl: string;
  progress: number;
  failed: boolean;
}

@Component({
  selector: 'app-employee-album-detail',
  templateUrl: 'employee-album-detail.page.html',
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

  readonly photos = toSignal(
    toObservable(this.albumId).pipe(
      switchMap((id) => (id ? this.albums.photosFor(id) : of<Photo[]>([]))),
    ),
    { initialValue: [] as Photo[] },
  );

  readonly canEdit = computed(() => {
    const a = this.album();
    const s = this.staff.currentStaff();
    if (!a || !s) return false;
    return s.allDepartments || s.departmentIds.includes(a.departmentId);
  });

  readonly uploads = signal<PendingUpload[]>([]);
  readonly uploading = computed(() => this.uploads().some((u) => !u.failed));

  protected readonly imagesOutline = imagesOutline;

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
      await this.albums.uploadPhoto(albumId, file, (fraction) => {
        this.uploads.update((list) =>
          list.map((u) => (u.id === entryId ? { ...u, progress: fraction } : u)),
        );
      });
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
      componentProps: { photos: this.photos(), startIndex: index },
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
          handler: () => {
            this.albums.removePhoto(photo);
          },
        },
      ],
    });
    await alert.present();
  }
}

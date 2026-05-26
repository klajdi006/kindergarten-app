import { Component, computed, inject, signal } from '@angular/core';
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
  IonProgressBar,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, cloudUploadOutline, imagesOutline } from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { of, switchMap } from 'rxjs';
import { AlbumsService } from '@app/data/albums.service';
import { StaffService } from '@app/data/staff.service';
import { Photo } from '@app/data/types';
import { PhotoViewerModal } from '@app/shared/components/photo-viewer/photo-viewer.modal';

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
    IonProgressBar,
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

  readonly uploading = signal(false);
  readonly uploadProgress = signal(0);

  protected readonly imagesOutline = imagesOutline;

  constructor() {
    addIcons({
      'cloud-upload-outline': cloudUploadOutline,
      'images-outline': imagesOutline,
      'close-outline': closeOutline,
    });
  }

  async onFilesPicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    if (files.length === 0) return;
    const id = this.albumId();
    if (!id) return;

    this.uploading.set(true);
    this.uploadProgress.set(0);
    try {
      for (let i = 0; i < files.length; i++) {
        await this.albums.uploadPhoto(id, files[i]);
        this.uploadProgress.set((i + 1) / files.length);
      }
    } catch (err) {
      console.warn('[albums] upload failed', err);
      const toast = await this.toastCtrl.create({
        message: this.t.instant('admin.albums.uploadFailed'),
        duration: 3000,
        color: 'danger',
        position: 'bottom',
      });
      await toast.present();
    } finally {
      this.uploading.set(false);
      this.uploadProgress.set(0);
    }
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

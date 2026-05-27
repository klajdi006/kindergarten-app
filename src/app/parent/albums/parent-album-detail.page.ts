import { Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSkeletonText,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, imagesOutline } from 'ionicons/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { map, of, startWith, switchMap } from 'rxjs';
import { AlbumsService } from '@app/data/albums.service';
import { Photo } from '@app/data/types';
import { PhotoViewerModal } from '@app/shared/components/photo-viewer/photo-viewer.modal';

@Component({
  selector: 'app-parent-album-detail',
  templateUrl: 'parent-album-detail.page.html',
  styleUrl: './parent-album-detail.page.scss',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonIcon,
    IonText,
    IonSkeletonText,
    TranslatePipe,
  ],
})
export class ParentAlbumDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly modalCtrl = inject(ModalController);
  readonly albums = inject(AlbumsService);

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

  constructor() {
    addIcons({
      'close-outline': closeOutline,
      'images-outline': imagesOutline,
    });
  }

  async openViewer(index: number): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: PhotoViewerModal,
      componentProps: { photos: this.photos(), startIndex: index },
    });
    await modal.present();
  }
}

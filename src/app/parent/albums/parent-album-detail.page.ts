import { Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, imagesOutline } from 'ionicons/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { of, switchMap } from 'rxjs';
import { AlbumsService } from '@app/data/albums.service';
import { Photo } from '@app/data/types';
import { PhotoViewerModal } from '@app/shared/components/photo-viewer/photo-viewer.modal';

@Component({
  selector: 'app-parent-album-detail',
  templateUrl: 'parent-album-detail.page.html',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonIcon,
    IonText,
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

  readonly photos = toSignal(
    toObservable(this.albumId).pipe(
      switchMap((id) => (id ? this.albums.photosFor(id) : of<Photo[]>([]))),
    ),
    { initialValue: [] as Photo[] },
  );

  protected readonly imagesOutline = imagesOutline;

  constructor() {
    addIcons({ 'close-outline': closeOutline });
  }

  async openViewer(index: number): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: PhotoViewerModal,
      componentProps: { photos: this.photos(), startIndex: index },
    });
    await modal.present();
  }
}

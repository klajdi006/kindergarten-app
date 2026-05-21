import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { imagesOutline } from 'ionicons/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { of, switchMap } from 'rxjs';
import { AlbumsService } from '@app/data/albums.service';

@Component({
  selector: 'app-admin-album-detail',
  templateUrl: 'admin-album-detail.page.html',
  host: { style: 'display: contents' },
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
export class AdminAlbumDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly albums = inject(AlbumsService);

  readonly listUrl = computed(() => {
    const url = this.router.url;
    const idx = url.lastIndexOf('/');
    return idx > 0 ? url.slice(0, idx) : '/';
  });

  readonly albumId = toSignal(
    this.route.paramMap.pipe(switchMap((p) => of(p.get('id')))),
    { initialValue: null as string | null },
  );

  readonly album = computed(() => {
    const id = this.albumId();
    return id ? this.albums.byId(id)() : null;
  });

  protected readonly imagesOutline = imagesOutline;
}

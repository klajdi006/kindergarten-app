import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AlertController,
  IonContent,
  IonFab,
  IonFabButton,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonText,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  createOutline,
  imagesOutline,
  trashOutline,
} from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AlbumsService } from '@app/data/albums.service';
import { DepartmentsService } from '@app/data/departments.service';
import { Album } from '@app/data/types';
import { AlbumFormModal, AlbumFormResult } from '@app/admin/albums/album-form/album-form.modal';
import { completeRefresher } from '@app/shared/utils/refresher';
import { SkeletonListComponent } from '@app/shared/components/skeleton-list/skeleton-list.component';

@Component({
  selector: 'app-admin-albums',
  templateUrl: 'admin-albums.page.html',
  host: { style: 'display: contents' },
  imports: [
    RouterLink,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonFab,
    IonFabButton,
    IonIcon,
    IonList,
    IonItem,
    IonItemSliding,
    IonItemOption,
    IonItemOptions,
    IonLabel,
    IonText,
    TranslatePipe,
    SkeletonListComponent,
  ],
})
export class AdminAlbumsPage {
  private readonly t = inject(TranslateService);
  private readonly alertCtrl = inject(AlertController);
  private readonly modalCtrl = inject(ModalController);
  readonly albums = inject(AlbumsService);
  readonly departments = inject(DepartmentsService);

  readonly departmentsById = computed(() => {
    const map = new Map<string, string>();
    for (const d of this.departments.all()) map.set(d.id, d.name);
    return map;
  });

  protected readonly createOutline = createOutline;
  protected readonly imagesOutline = imagesOutline;
  protected readonly trashOutline = trashOutline;
  protected readonly onRefresh = completeRefresher;

  readonly loading = signal(true);

  constructor() {
    addIcons({ 'add-outline': addOutline });
    effect(() => {
      if (this.albums.all().length > 0) this.loading.set(false);
    });
    setTimeout(() => this.loading.set(false), 1500);
  }

  departmentName(id: string): string {
    return this.departmentsById().get(id) ?? this.t.instant('admin.children.unassigned');
  }

  openCreate(): Promise<void> {
    return this.openForm(null);
  }

  async openEdit(album: Album, event: Event): Promise<void> {
    event.stopPropagation();
    return this.openForm(album);
  }

  private async openForm(album: Album | null): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: AlbumFormModal,
      componentProps: { album, departments: this.departments.all() },
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<AlbumFormResult>();
    if (role !== 'confirm' || !data) return;
    if (album) {
      await this.albums.update(album.id, data);
    } else {
      await this.albums.add(data);
    }
  }

  async confirmDelete(album: Album, event: Event): Promise<void> {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: this.t.instant('common.confirmDeleteTitle'),
      message: this.t.instant('common.confirmDeleteMessage', { name: album.name }),
      buttons: [
        { text: this.t.instant('common.cancel'), role: 'cancel' },
        {
          text: this.t.instant('common.delete'),
          role: 'destructive',
          handler: () => {
            this.albums.remove(album.id);
          },
        },
      ],
    });
    await alert.present();
  }
}

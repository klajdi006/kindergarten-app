import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ActionSheetController,
  AlertController,
  IonButton,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  createOutline,
  ellipsisVerticalOutline,
  imagesOutline,
  trashOutline,
} from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AlbumsService } from '@app/data/albums.service';
import { DepartmentsService } from '@app/data/departments.service';
import { StaffService } from '@app/data/staff.service';
import { Album, Department } from '@app/data/types';
import { AlbumFormModal, AlbumFormResult } from '@app/admin/albums/album-form/album-form.modal';
import { completeRefresher } from '@app/shared/utils/refresher';
import { SkeletonListComponent } from '@app/shared/components/skeleton-list/skeleton-list.component';

@Component({
  selector: 'app-employee-albums',
  templateUrl: 'employee-albums.page.html',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonFab,
    IonFabButton,
    IonIcon,
    IonList,
    IonItem,
    IonButton,
    IonLabel,
    IonText,
    TranslatePipe,
    SkeletonListComponent,
  ],
})
export class EmployeeAlbumsPage {
  private readonly t = inject(TranslateService);
  private readonly alertCtrl = inject(AlertController);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly modalCtrl = inject(ModalController);
  private readonly router = inject(Router);
  private readonly staff = inject(StaffService);
  readonly albums = inject(AlbumsService);
  readonly departments = inject(DepartmentsService);

  readonly departmentsById = computed(() => {
    const map = new Map<string, string>();
    for (const d of this.departments.all()) map.set(d.id, d.name);
    return map;
  });

  /** Albums the employee can see — those whose dept they have access to. */
  readonly visibleAlbums = computed<Album[]>(() => {
    const s = this.staff.currentStaff();
    if (!s) return [];
    if (s.allDepartments) return this.albums.all();
    const ids = new Set(s.departmentIds);
    return this.albums.all().filter((a) => ids.has(a.departmentId));
  });

  /** Departments this employee is allowed to create albums for. */
  readonly creatableDepartments = computed<Department[]>(() => {
    const s = this.staff.currentStaff();
    if (!s) return [];
    if (s.allDepartments) return this.departments.all();
    return this.departments.all().filter((d) => s.departmentIds.includes(d.id));
  });

  canEdit(album: Album): boolean {
    const s = this.staff.currentStaff();
    if (!s) return false;
    return s.allDepartments || s.departmentIds.includes(album.departmentId);
  }

  protected readonly createOutline = createOutline;
  protected readonly ellipsisVerticalOutline = ellipsisVerticalOutline;
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

  /** Programmatic navigation from the row body. Skipped when the ellipsis
   *  button is the click target so the menu can pop without also navigating. */
  openAlbum(album: Album, event: Event): void {
    if ((event.target as HTMLElement | null)?.closest('ion-button')) return;
    void this.router.navigate(['/employee/albums', album.id]);
  }

  openCreate(): Promise<void> {
    return this.openForm(null);
  }

  /**
   * End-slot ellipsis on each row. Opens an action sheet with Edit / Delete.
   * `event.stopPropagation()` prevents the parent ion-item's routerLink from
   * firing when the user taps the ellipsis.
   */
  async openMenu(album: Album, event: Event): Promise<void> {
    event.stopPropagation();
    if (!this.canEdit(album)) return;
    const sheet = await this.actionSheetCtrl.create({
      header: album.name,
      buttons: [
        {
          text: this.t.instant('admin.albums.edit'),
          icon: createOutline,
          handler: () => {
            this.openForm(album);
          },
        },
        {
          text: this.t.instant('common.delete'),
          icon: trashOutline,
          role: 'destructive',
          handler: () => {
            this.confirmDelete(album);
          },
        },
        { text: this.t.instant('common.cancel'), role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  private async openForm(album: Album | null): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: AlbumFormModal,
      componentProps: { album, departments: this.creatableDepartments() },
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

  async confirmDelete(album: Album): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.t.instant('common.confirmDeleteTitle'),
      message: this.t.instant('admin.albums.confirmDeleteAlbum', { name: album.name }),
      buttons: [
        { text: this.t.instant('common.cancel'), role: 'cancel' },
        {
          text: this.t.instant('common.delete'),
          role: 'destructive',
          handler: async () => {
            try {
              await this.albums.remove(album.id);
            } catch (err) {
              console.error('[albums] remove failed', err);
            }
          },
        },
      ],
    });
    await alert.present();
  }
}

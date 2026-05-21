import { Component, effect, inject, signal } from '@angular/core';
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
import { addOutline, createOutline, trashOutline } from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DepartmentsService } from '@app/data/departments.service';
import { Department } from '@app/data/types';
import {
  DepartmentFormModal,
  DepartmentFormResult,
} from '@app/admin/departments/department-form/department-form.modal';
import { completeRefresher } from '@app/shared/utils/refresher';
import { SkeletonListComponent } from '@app/shared/components/skeleton-list/skeleton-list.component';

@Component({
  selector: 'app-admin-departments',
  templateUrl: 'admin-departments.page.html',
  host: { style: 'display: contents' },
  imports: [
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
export class AdminDepartmentsPage {
  private readonly t = inject(TranslateService);
  private readonly alertCtrl = inject(AlertController);
  private readonly modalCtrl = inject(ModalController);
  readonly departments = inject(DepartmentsService);

  protected readonly onRefresh = completeRefresher;

  readonly loading = signal(true);

  constructor() {
    addIcons({
      'add-outline': addOutline,
      'create-outline': createOutline,
      'trash-outline': trashOutline,
    });
    effect(() => {
      if (this.departments.all().length > 0) this.loading.set(false);
    });
    setTimeout(() => this.loading.set(false), 1500);
  }

  openCreate(): Promise<void> {
    return this.openForm(null);
  }

  openEdit(dept: Department): Promise<void> {
    return this.openForm(dept);
  }

  private async openForm(department: Department | null): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: DepartmentFormModal,
      componentProps: { department },
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<DepartmentFormResult>();
    if (role !== 'confirm' || !data) return;
    if (department) {
      await this.departments.update(department.id, data);
    } else {
      await this.departments.add(data);
    }
  }

  async confirmDelete(dept: Department): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.t.instant('common.confirmDeleteTitle'),
      message: this.t.instant('common.confirmDeleteMessage', { name: dept.name }),
      buttons: [
        { text: this.t.instant('common.cancel'), role: 'cancel' },
        {
          text: this.t.instant('common.delete'),
          role: 'destructive',
          handler: () => {
            this.departments.remove(dept.id);
          },
        },
      ],
    });
    await alert.present();
  }
}

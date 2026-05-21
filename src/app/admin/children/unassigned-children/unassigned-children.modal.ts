import { Component, computed, inject } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { ChildDetailModal } from '@app/admin/children/child-detail/child-detail.modal';
import { ChildrenService } from '@app/data/children.service';
import { DepartmentsService } from '@app/data/departments.service';
import { Child } from '@app/data/types';
import { DateDmyPipe } from '@app/shared/pipes/date-dmy.pipe';

@Component({
  selector: 'app-unassigned-children-modal',
  templateUrl: 'unassigned-children.modal.html',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonText,
    TranslatePipe,
    DateDmyPipe,
  ],
})
export class UnassignedChildrenModal {
  private readonly modalCtrl = inject(ModalController);
  readonly children = inject(ChildrenService);
  readonly departments = inject(DepartmentsService);

  readonly unassigned = computed(() =>
    this.children.all().filter((c) => c.parentIds.length === 0),
  );

  constructor() {
    addIcons({ 'close-outline': closeOutline });
  }

  async openEdit(child: Child): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: ChildDetailModal,
      componentProps: { childId: child.id },
    });
    await modal.present();
  }

  close(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }
}

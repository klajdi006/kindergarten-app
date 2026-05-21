import { Component, computed, inject } from '@angular/core';
import {
  IonAvatar,
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
import { ParentDetailModal } from '@app/admin/parents/parent-detail/parent-detail.modal';
import { ParentsService } from '@app/data/parents.service';
import { Parent } from '@app/data/types';

@Component({
  selector: 'app-pending-parents-modal',
  templateUrl: 'pending-parents.modal.html',
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
    IonAvatar,
    IonLabel,
    IonText,
    TranslatePipe,
  ],
})
export class PendingParentsModal {
  private readonly modalCtrl = inject(ModalController);
  readonly parents = inject(ParentsService);

  readonly pending = computed(() => this.parents.all().filter((p) => !p.claimedByUid));

  constructor() {
    addIcons({ 'close-outline': closeOutline });
  }

  initials(p: Parent): string {
    return (
      [p.firstName?.[0], p.lastName?.[0]]
        .filter(Boolean)
        .join('')
        .toUpperCase() || '?'
    );
  }

  async openDetail(parent: Parent): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: ParentDetailModal,
      componentProps: { parentId: parent.id },
    });
    await modal.present();
  }

  close(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }
}

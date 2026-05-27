import { Component, computed, inject } from '@angular/core';
import {
  IonAvatar,
  IonBadge,
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
import { StaffDetailModal } from '@app/admin/staff/staff-detail/staff-detail.modal';
import { StaffService } from '@app/data/staff.service';
import { Staff } from '@app/data/types';

@Component({
  selector: 'app-pending-staff-modal',
  templateUrl: 'pending-staff.modal.html',
  styleUrl: './pending-staff.modal.scss',
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
    IonBadge,
    IonLabel,
    IonText,
    TranslatePipe,
  ],
})
export class PendingStaffModal {
  private readonly modalCtrl = inject(ModalController);
  readonly staff = inject(StaffService);

  readonly pending = computed(() => this.staff.all().filter((s) => !s.claimedByUid));

  constructor() {
    addIcons({ 'close-outline': closeOutline });
  }

  initials(s: Staff): string {
    return (
      [s.firstName?.[0], s.lastName?.[0]]
        .filter(Boolean)
        .join('')
        .toUpperCase() || '?'
    );
  }

  async openDetail(record: Staff): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: StaffDetailModal,
      componentProps: { staffId: record.id },
    });
    await modal.present();
  }

  close(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }
}

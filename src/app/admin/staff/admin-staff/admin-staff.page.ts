import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import {
  AlertController,
  IonAvatar,
  IonBadge,
  IonChip,
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
import { addOutline, trashOutline } from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '@app/auth/auth.service';
import { StaffService } from '@app/data/staff.service';
import { Staff, StaffRole } from '@app/data/types';
import { StaffFormModal, StaffFormResult } from '@app/admin/staff/staff-form/staff-form.modal';
import { StaffDetailModal } from '@app/admin/staff/staff-detail/staff-detail.modal';
import { completeRefresher } from '@app/shared/utils/refresher';
import { SkeletonListComponent } from '@app/shared/components/skeleton-list/skeleton-list.component';

type Filter = 'all' | StaffRole;

@Component({
  selector: 'app-admin-staff',
  templateUrl: 'admin-staff.page.html',
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
    IonAvatar,
    IonBadge,
    IonChip,
    IonText,
    TranslatePipe,
    SkeletonListComponent,
  ],
})
export class AdminStaffPage {
  private readonly t = inject(TranslateService);
  private readonly auth = inject(AuthService);
  private readonly alertCtrl = inject(AlertController);
  private readonly modalCtrl = inject(ModalController);
  readonly staff = inject(StaffService);

  private readonly route = inject(ActivatedRoute);

  readonly filter = signal<Filter>('all');
  readonly pendingOnly = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('filter') === 'pending')),
    { initialValue: false },
  );

  readonly visible = computed<Staff[]>(() => {
    const f = this.filter();
    const uid = this.auth.currentUser()?.uid;
    let list = this.staff.all().filter((s) => s.claimedByUid !== uid);
    if (this.pendingOnly()) list = list.filter((s) => !s.claimedByUid);
    if (f !== 'all') list = list.filter((s) => s.role === f);
    return list;
  });

  protected readonly trashOutline = trashOutline;
  protected readonly onRefresh = completeRefresher;

  readonly loading = signal(true);

  constructor() {
    addIcons({ 'add-outline': addOutline });
    effect(() => {
      if (this.staff.all().length > 0) this.loading.set(false);
    });
    setTimeout(() => this.loading.set(false), 1500);
  }

  setFilter(value: Filter): void {
    this.filter.set(value);
  }

  initials(s: Staff): string {
    return (
      [s.firstName?.[0], s.lastName?.[0]]
        .filter(Boolean)
        .join('')
        .toUpperCase() || '?'
    );
  }

  async openCreate(): Promise<void> {
    const modal = await this.modalCtrl.create({ component: StaffFormModal });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<StaffFormResult>();
    if (role === 'confirm' && data) {
      await this.staff.add(data);
    }
  }

  async openDetail(record: Staff): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: StaffDetailModal,
      componentProps: { staffId: record.id },
    });
    await modal.present();
  }

  async confirmDelete(record: Staff): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.t.instant('common.confirmDeleteTitle'),
      message: this.t.instant('common.confirmDeleteMessage', {
        name: `${record.firstName} ${record.lastName}`,
      }),
      buttons: [
        { text: this.t.instant('common.cancel'), role: 'cancel' },
        {
          text: this.t.instant('common.delete'),
          role: 'destructive',
          handler: () => {
            this.staff.remove(record.id);
          },
        },
      ],
    });
    await alert.present();
  }
}

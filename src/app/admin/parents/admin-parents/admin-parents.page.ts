import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import {
  AlertController,
  IonAvatar,
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
import { ParentsService } from '@app/data/parents.service';
import { Parent } from '@app/data/types';
import { completeRefresher } from '@app/shared/utils/refresher';
import { ParentFormModal, ParentFormResult } from '@app/admin/parents/parent-form/parent-form.modal';
import { ParentDetailModal } from '@app/admin/parents/parent-detail/parent-detail.modal';
import { SkeletonListComponent } from '@app/shared/components/skeleton-list/skeleton-list.component';

@Component({
  selector: 'app-admin-parents',
  templateUrl: 'admin-parents.page.html',
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
    IonText,
    TranslatePipe,
    SkeletonListComponent,
  ],
})
export class AdminParentsPage {
  private readonly t = inject(TranslateService);
  private readonly alertCtrl = inject(AlertController);
  private readonly modalCtrl = inject(ModalController);
  private readonly route = inject(ActivatedRoute);
  readonly parents = inject(ParentsService);

  protected readonly trashOutline = trashOutline;
  protected readonly onRefresh = completeRefresher;

  readonly filter = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('filter'))),
    { initialValue: null as string | null },
  );

  readonly displayedParents = computed(() => {
    const all = this.parents.all();
    if (this.filter() === 'pending') {
      return all.filter((p) => !p.claimedByUid);
    }
    return all;
  });

  readonly loading = signal(true);

  constructor() {
    addIcons({ 'add-outline': addOutline });
    effect(() => {
      if (this.parents.all().length > 0) this.loading.set(false);
    });
    setTimeout(() => this.loading.set(false), 1500);
  }

  initials(p: Parent): string {
    return (
      [p.firstName?.[0], p.lastName?.[0]]
        .filter(Boolean)
        .join('')
        .toUpperCase() || '?'
    );
  }

  async openCreate(): Promise<void> {
    const modal = await this.modalCtrl.create({ component: ParentFormModal });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<ParentFormResult>();
    if (role === 'confirm' && data) {
      await this.parents.add(data);
    }
  }

  async openDetail(parent: Parent): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: ParentDetailModal,
      componentProps: { parentId: parent.id },
    });
    await modal.present();
  }

  async confirmDelete(parent: Parent): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.t.instant('common.confirmDeleteTitle'),
      message: this.t.instant('common.confirmDeleteMessage', {
        name: `${parent.firstName} ${parent.lastName}`,
      }),
      buttons: [
        { text: this.t.instant('common.cancel'), role: 'cancel' },
        {
          text: this.t.instant('common.delete'),
          role: 'destructive',
          handler: () => {
            this.parents.remove(parent.id);
          },
        },
      ],
    });
    await alert.present();
  }
}

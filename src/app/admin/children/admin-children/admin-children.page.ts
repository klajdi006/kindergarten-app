import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
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
import { DateDmyPipe } from '@app/shared/pipes/date-dmy.pipe';
import { ChildrenService } from '@app/data/children.service';
import { DepartmentsService } from '@app/data/departments.service';
import { Child } from '@app/data/types';
import { ChildDetailModal } from '@app/admin/children/child-detail/child-detail.modal';
import { ChildFormModal, ChildFormResult } from '@app/admin/children/child-form/child-form.modal';
import { completeRefresher } from '@app/shared/utils/refresher';
import { SkeletonListComponent } from '@app/shared/components/skeleton-list/skeleton-list.component';

@Component({
  selector: 'app-admin-children',
  templateUrl: 'admin-children.page.html',
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
    DateDmyPipe,
    SkeletonListComponent,
  ],
})
export class AdminChildrenPage {
  private readonly t = inject(TranslateService);
  private readonly alertCtrl = inject(AlertController);
  private readonly modalCtrl = inject(ModalController);
  private readonly route = inject(ActivatedRoute);
  readonly children = inject(ChildrenService);
  readonly departments = inject(DepartmentsService);

  protected readonly onRefresh = completeRefresher;

  readonly filter = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('filter'))),
    { initialValue: null as string | null },
  );

  readonly displayedChildren = computed(() => {
    const all = this.children.all();
    if (this.filter() === 'unassigned') {
      return all.filter((c) => !c.departmentId);
    }
    return all;
  });

  readonly departmentsById = computed(() => {
    const map = new Map<string, string>();
    for (const d of this.departments.all()) map.set(d.id, d.name);
    return map;
  });

  readonly loading = signal(true);

  constructor() {
    addIcons({
      'add-outline': addOutline,
      'create-outline': createOutline,
      'trash-outline': trashOutline,
    });
    effect(() => {
      if (this.children.all().length > 0) this.loading.set(false);
    });
    setTimeout(() => this.loading.set(false), 1500);
  }

  departmentName(id: string | null): string {
    if (!id) return this.t.instant('admin.children.unassigned');
    return this.departmentsById().get(id) ?? this.t.instant('admin.children.unassigned');
  }

  async openCreate(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: ChildFormModal,
      componentProps: { child: null, departments: this.departments.all() },
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<ChildFormResult>();
    if (role === 'confirm' && data) {
      await this.children.add(data);
    }
  }

  async openEdit(child: Child): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: ChildDetailModal,
      componentProps: { childId: child.id },
    });
    await modal.present();
  }

  async confirmDelete(child: Child): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.t.instant('common.confirmDeleteTitle'),
      message: this.t.instant('common.confirmDeleteMessage', {
        name: `${child.firstName} ${child.lastName}`,
      }),
      buttons: [
        { text: this.t.instant('common.cancel'), role: 'cancel' },
        {
          text: this.t.instant('common.delete'),
          role: 'destructive',
          handler: () => {
            this.children.remove(child.id);
          },
        },
      ],
    });
    await alert.present();
  }
}

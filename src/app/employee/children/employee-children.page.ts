import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { happyOutline } from 'ionicons/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { of, switchMap } from 'rxjs';
import { ChildrenService } from '@app/data/children.service';
import { DepartmentsService } from '@app/data/departments.service';
import { StaffService } from '@app/data/staff.service';
import { Child } from '@app/data/types';
import { SkeletonListComponent } from '@app/shared/components/skeleton-list/skeleton-list.component';
import { EmployeeChildDetailModal } from '@app/employee/children/employee-child-detail/employee-child-detail.modal';

@Component({
  selector: 'app-employee-children',
  templateUrl: 'employee-children.page.html',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSearchbar,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonText,
    TranslatePipe,
    SkeletonListComponent,
  ],
})
export class EmployeeChildrenPage {
  private readonly staff = inject(StaffService);
  private readonly childrenService = inject(ChildrenService);
  private readonly departments = inject(DepartmentsService);
  private readonly modalCtrl = inject(ModalController);

  readonly loading = signal(true);
  readonly searchQuery = signal('');

  readonly me = this.staff.currentStaff;

  readonly myChildren = toSignal(
    toObservable(this.me).pipe(
      switchMap((s) => (s ? this.childrenService.forStaff(s) : of<Child[]>([]))),
    ),
    {
      initialValue: [] as Child[],
    },
  );

  readonly filtered = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const sorted = this.myChildren()
      .slice()
      .sort(
        (a, b) =>
          a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName),
      );
    if (!q) return sorted;
    return sorted.filter((c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q),
    );
  });

  constructor() {
    addIcons({ 'happy-outline': happyOutline });
    // Reveal list once children load or after a short timeout (empty departments case).
    const stopLoading = toObservable(this.myChildren).subscribe((list) => {
      if (list.length > 0) {
        this.loading.set(false);
        stopLoading.unsubscribe();
      }
    });
    setTimeout(() => this.loading.set(false), 1500);
  }

  departmentName(deptId: string | null): string {
    if (!deptId) return '';
    return this.departments.all().find((d) => d.id === deptId)?.name ?? '';
  }

  async openChild(child: Child): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: EmployeeChildDetailModal,
      componentProps: { child },
    });
    await modal.present();
  }

  onSearch(event: Event): void {
    this.searchQuery.set((event as CustomEvent).detail.value ?? '');
  }
}

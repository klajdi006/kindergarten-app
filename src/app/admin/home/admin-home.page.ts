import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  IonBadge,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonText,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  briefcaseOutline,
  businessOutline,
  cashOutline,
  giftOutline,
  mailOutline,
  megaphoneOutline,
  peopleOutline,
} from 'ionicons/icons';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { PendingParentsModal } from '@app/admin/parents/pending-parents/pending-parents.modal';
import { PendingStaffModal } from '@app/admin/staff/pending-staff/pending-staff.modal';
import { UnassignedChildrenModal } from '@app/admin/children/unassigned-children/unassigned-children.modal';
import { AuthService } from '@app/auth/auth.service';
import { ChildrenService } from '@app/data/children.service';
import { DepartmentsService } from '@app/data/departments.service';
import { ParentsService } from '@app/data/parents.service';
import { PostsService } from '@app/data/posts.service';
import { StaffService } from '@app/data/staff.service';
import { Child, Post } from '@app/data/types';
import { completeRefresher } from '@app/shared/utils/refresher';
import { PostViewModal } from '@app/shared/components/post-view/post-view.modal';
import { TabHeaderComponent } from '@app/shared/components/tab-header/tab-header.component';
import { DateDmyPipe } from '@app/shared/pipes/date-dmy.pipe';

@Component({
  selector: 'app-admin-home',
  templateUrl: 'admin-home.page.html',
  styleUrl: './admin-home.page.scss',
  imports: [
    DecimalPipe,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonCard,
    IonCardContent,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonIcon,
    IonBadge,
    IonNote,
    IonText,
    TabHeaderComponent,
    TranslatePipe,
    DateDmyPipe,
  ],
})
export class AdminHomePage {
  readonly auth = inject(AuthService);
  readonly parents = inject(ParentsService);
  readonly children = inject(ChildrenService);
  readonly departments = inject(DepartmentsService);
  readonly staff = inject(StaffService);
  readonly posts = inject(PostsService);
  private readonly modalCtrl = inject(ModalController);

  protected readonly onRefresh = completeRefresher;

  async openPendingParents(): Promise<void> {
    const modal = await this.modalCtrl.create({ component: PendingParentsModal });
    await modal.present();
  }

  async openPendingStaff(): Promise<void> {
    const modal = await this.modalCtrl.create({ component: PendingStaffModal });
    await modal.present();
  }

  async openUnassignedChildren(): Promise<void> {
    const modal = await this.modalCtrl.create({ component: UnassignedChildrenModal });
    await modal.present();
  }

  async openPost(post: Post): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: PostViewModal,
      componentProps: { post, departmentName: this.departmentName(post.departmentId) || null },
    });
    await modal.present();
  }

  readonly enrolledCount = computed(() => this.children.count());
  readonly employeeCount = computed(() => this.staff.employees().length);
  readonly monthlyRevenue = computed(() =>
    this.children.all().reduce((sum, c) => sum + (c.tariff ?? 0), 0),
  );

  readonly pendingParents = computed(
    () => this.parents.all().filter((p) => p.claimedByUid === null).length,
  );
  readonly pendingStaff = computed(
    () => this.staff.all().filter((s) => s.claimedByUid === null).length,
  );
  readonly unassignedChildren = computed(
    () => this.children.all().filter((c) => c.parentIds.length === 0).length,
  );

  readonly hasAttention = computed(
    () => this.pendingParents() + this.pendingStaff() + this.unassignedChildren() > 0,
  );

  readonly departmentRows = computed(() =>
    this.departments
      .all()
      .map((d) => ({
        dept: d,
        count: this.children.all().filter((c) => c.departmentId === d.id).length,
      }))
      .sort((a, b) => b.count - a.count),
  );

  readonly upcomingBirthdays = computed<Child[]>(() => {
    const now = new Date();
    const todayDoy = monthDay(now);
    const horizonDoy = monthDay(addDays(now, 7));
    const wraps = horizonDoy < todayDoy;
    return this.children
      .all()
      .filter((c) => {
        const birth = new Date(c.birthDate);
        if (Number.isNaN(birth.getTime())) return false;
        const doy = monthDay(birth);
        return wraps ? doy >= todayDoy || doy <= horizonDoy : doy >= todayDoy && doy <= horizonDoy;
      })
      .slice()
      .sort(
        (a, b) =>
          sortableDoy(new Date(a.birthDate), todayDoy) -
          sortableDoy(new Date(b.birthDate), todayDoy),
      )
      .slice(0, 5);
  });

  readonly recentPosts = computed<Post[]>(() => this.posts.all().slice(0, 3));

  departmentName(deptId: string | null): string {
    if (!deptId) return '';
    return this.departments.all().find((d) => d.id === deptId)?.name ?? '';
  }

  readonly loading = signal(true);

  constructor() {
    addIcons({
      'mail-outline': mailOutline,
      'alert-circle-outline': alertCircleOutline,
      'briefcase-outline': briefcaseOutline,
      'business-outline': businessOutline,
      'cash-outline': cashOutline,
      'gift-outline': giftOutline,
      'megaphone-outline': megaphoneOutline,
      'people-outline': peopleOutline,
    });
    effect(() => {
      if (
        this.parents.count() > 0 ||
        this.children.count() > 0 ||
        this.departments.count() > 0
      ) {
        this.loading.set(false);
      }
    });
    setTimeout(() => this.loading.set(false), 1500);
  }
}

function monthDay(d: Date): number {
  return d.getMonth() * 100 + d.getDate();
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function sortableDoy(birth: Date, todayDoy: number): number {
  const doy = monthDay(birth);
  return doy >= todayDoy ? doy : doy + 1200;
}

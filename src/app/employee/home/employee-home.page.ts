import { Component, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  IonBadge,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  bandageOutline,
  giftOutline,
  happyOutline,
  megaphoneOutline,
  sunnyOutline,
  timeOutline,
} from 'ionicons/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { AuthService } from '@app/auth/auth.service';
import { AbsencesService } from '@app/data/absences.service';
import { ChildrenService } from '@app/data/children.service';
import { DepartmentsService } from '@app/data/departments.service';
import { KindergartensService } from '@app/data/kindergartens.service';
import { NotificationsService } from '@app/data/notifications.service';
import { PostsService } from '@app/data/posts.service';
import {
  DEFAULT_OPERATING_HOURS,
  OperatingHours,
  WEEK_DAYS,
  WeekDay,
  WeeklySchedule,
  defaultScheduleFor,
  getOperatingHours,
  getWeeklySchedule,
} from '@app/data/schedule';
import { SchedulesService } from '@app/data/schedules.service';
import { StaffService } from '@app/data/staff.service';
import { Absence, Child, Post } from '@app/data/types';
import { EmployeeChildDetailModal } from '@app/employee/children/employee-child-detail/employee-child-detail.modal';
import { DateDmyPipe } from '@app/shared/pipes/date-dmy.pipe';
import { completeRefresher } from '@app/shared/utils/refresher';
import { SkeletonListComponent } from '@app/shared/components/skeleton-list/skeleton-list.component';

interface RosterRow {
  child: Child;
  status: 'expected' | 'sick' | 'holiday';
  arrival: string;
  departure: string;
}

@Component({
  selector: 'app-employee-home',
  templateUrl: 'employee-home.page.html',
  styleUrl: './employee-home.page.scss',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonBadge,
    IonCard,
    IonCardContent,
    IonChip,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonIcon,
    IonText,
    IonRefresher,
    IonRefresherContent,
    TranslatePipe,
    DateDmyPipe,
    SkeletonListComponent,
  ],
})
export class EmployeeHomePage {
  readonly auth = inject(AuthService);
  readonly staff = inject(StaffService);
  private readonly modalCtrl = inject(ModalController);
  readonly children = inject(ChildrenService);
  readonly departments = inject(DepartmentsService);
  readonly absences = inject(AbsencesService);
  readonly schedules = inject(SchedulesService);
  readonly kindergartens = inject(KindergartensService);
  readonly posts = inject(PostsService);
  readonly notifications = inject(NotificationsService);

  readonly newSickAtEntry = signal(0);

  readonly me = this.staff.currentStaff;
  protected readonly onRefresh = completeRefresher;

  readonly myChildren = toSignal(
    toObservable(this.me).pipe(
      switchMap((s) => (s ? this.children.forStaff(s) : of<Child[]>([]))),
    ),
    { initialValue: [] as Child[] },
  );

  readonly myChildIds = computed(() => new Set(this.myChildren().map((c) => c.id)));

  readonly today = computed(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });

  readonly todayWeekday = computed<WeekDay>(() => {
    const d = new Date();
    return WEEK_DAYS[(d.getDay() + 6) % 7];
  });

  private readonly operatingHours = computed<OperatingHours>(() =>
    getOperatingHours(this.kindergartens.current()),
  );

  // Map of childId → stored weekly schedule (null if none yet).
  private readonly schedulesByChild = toSignal(
    toObservable(this.myChildren).pipe(
      switchMap((children) => {
        if (children.length === 0) return of<Record<string, WeeklySchedule | null>>({});
        return combineLatest(
          children.map((c) => this.schedules.forChild(c.id).pipe(map((s) => [c.id, s] as const))),
        ).pipe(
          map((pairs) => {
            const acc: Record<string, WeeklySchedule | null> = {};
            for (const [id, s] of pairs) acc[id] = s;
            return acc;
          }),
        );
      }),
    ),
    { initialValue: {} as Record<string, WeeklySchedule | null> },
  );

  readonly todaysAbsences = computed<Absence[]>(() => {
    const today = this.today();
    const ids = this.myChildIds();
    return this.absences
      .all()
      .filter((a) => ids.has(a.childId) && a.startDate <= today && a.endDate >= today);
  });

  readonly sickToday = computed(() => this.todaysAbsences().filter((a) => a.type === 'sick'));
  readonly onHolidayToday = computed(() =>
    this.todaysAbsences().filter((a) => a.type === 'holiday'),
  );

  // Children scheduled for today, plus their arrival/departure and absence status.
  readonly todayRoster = computed<RosterRow[]>(() => {
    const weekday = this.todayWeekday();
    const hours = this.operatingHours();
    const schedules = this.schedulesByChild();
    const sickIds = new Set(this.sickToday().map((a) => a.childId));
    const holidayIds = new Set(this.onHolidayToday().map((a) => a.childId));

    const rows: RosterRow[] = [];
    for (const child of this.myChildren()) {
      const weekly = getWeeklySchedule(schedules[child.id] ?? null, hours);
      const day = weekly[weekday];
      if (!day.attending) continue;
      const status: RosterRow['status'] = sickIds.has(child.id)
        ? 'sick'
        : holidayIds.has(child.id)
          ? 'holiday'
          : 'expected';
      rows.push({ child, status, arrival: day.arrival, departure: day.departure });
    }
    rows.sort((a, b) => a.arrival.localeCompare(b.arrival));
    return rows;
  });

  readonly stats = computed(() => {
    const roster = this.todayRoster();
    const sick = roster.filter((r) => r.status === 'sick').length;
    const holiday = roster.filter((r) => r.status === 'holiday').length;
    const expected = roster.length;
    const present = expected - sick - holiday;
    return { expected, present, sick, holiday };
  });

  // Upcoming birthdays within the next 7 days (inclusive of today).
  readonly upcomingBirthdays = computed<Child[]>(() => {
    const today = new Date();
    const todayDoy = monthDay(today);
    const horizonDoy = monthDay(addDays(today, 7));
    const wraps = horizonDoy < todayDoy;
    const list = this.myChildren()
      .filter((c) => {
        const birth = new Date(c.birthDate);
        if (Number.isNaN(birth.getTime())) return false;
        const doy = monthDay(birth);
        return wraps ? doy >= todayDoy || doy <= horizonDoy : doy >= todayDoy && doy <= horizonDoy;
      })
      .slice()
      .sort((a, b) => {
        const ad = sortableDoy(new Date(a.birthDate), todayDoy);
        const bd = sortableDoy(new Date(b.birthDate), todayDoy);
        return ad - bd;
      });
    return list;
  });

  readonly recentPosts = computed<Post[]>(() =>
    this.posts.all().slice(0, 3),
  );

  childName(childId: string): string {
    const c = this.myChildren().find((x) => x.id === childId);
    return c ? `${c.firstName} ${c.lastName}` : '';
  }

  departmentName(deptId: string | null): string {
    if (!deptId) return '';
    return this.departments.all().find((d) => d.id === deptId)?.name ?? '';
  }

  iconForStatus(status: RosterRow['status']): string {
    switch (status) {
      case 'sick':
        return 'bandage-outline';
      case 'holiday':
        return 'sunny-outline';
      default:
        return 'happy-outline';
    }
  }

  async openChild(child: Child): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: EmployeeChildDetailModal,
      componentProps: { child },
    });
    await modal.present();
  }

  colorForStatus(status: RosterRow['status']): string {
    switch (status) {
      case 'sick':
        return 'danger';
      case 'holiday':
        return 'warning';
      default:
        return 'success';
    }
  }

  protected readonly DEFAULT_OPERATING_HOURS = DEFAULT_OPERATING_HOURS;
  protected readonly defaultScheduleFor = defaultScheduleFor;

  readonly loading = signal(true);

  constructor() {
    addIcons({
      'bandage-outline': bandageOutline,
      'happy-outline': happyOutline,
      'sunny-outline': sunnyOutline,
      'time-outline': timeOutline,
      'gift-outline': giftOutline,
      'megaphone-outline': megaphoneOutline,
    });
    effect(() => {
      if (this.myChildren().length > 0) this.loading.set(false);
    });
    setTimeout(() => this.loading.set(false), 1500);

    let markedFor: string | null = null;
    effect(() => {
      const s = this.me();
      if (s && markedFor !== s.id) {
        markedFor = s.id;
        // Snapshot the unread count BEFORE marking seen so the home badge
        // still reflects what arrived since last visit.
        this.newSickAtEntry.set(this.notifications.staffUnreadSickCount());
        void this.staff.markSickSeen();
      }
    });
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
  // For wrap-around (e.g. today Dec 30, child born Jan 2), shift past-year dates forward.
  return doy >= todayDoy ? doy : doy + 1200;
}

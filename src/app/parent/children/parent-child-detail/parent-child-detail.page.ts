import { Component, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AlertController,
  DatetimeChangeEventDetail,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonDatetime,
  IonDatetimeButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonRefresher,
  IonRefresherContent,
  IonText,
  IonTitle,
  IonToggle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  bandageOutline,
  businessOutline,
  calendarOutline,
  documentOutline,
  downloadOutline,
  femaleOutline,
  happyOutline,
  hourglassOutline,
  maleOutline,
  sunnyOutline,
  timeOutline,
  trashOutline,
} from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { of, switchMap } from 'rxjs';
import { DateDmyPipe } from '@app/shared/pipes/date-dmy.pipe';
import { AbsencesService } from '@app/data/absences.service';
import { ChildrenService } from '@app/data/children.service';
import { DepartmentsService } from '@app/data/departments.service';
import { DocumentsService } from '@app/data/documents.service';
import { KindergartensService } from '@app/data/kindergartens.service';
import { ParentsService } from '@app/data/parents.service';
import { SchedulesService } from '@app/data/schedules.service';
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
import { Absence, Child, ChildDocument, Department } from '@app/data/types';
import { AbsenceHistoryModal } from '@app/parent/children/absence-history/absence-history.modal';
import { completeRefresher } from '@app/shared/utils/refresher';
import { SkeletonListComponent } from '@app/shared/components/skeleton-list/skeleton-list.component';

@Component({
  selector: 'app-parent-child-detail',
  templateUrl: 'parent-child-detail.page.html',
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonContent,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonIcon,
    IonText,
    IonToggle,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    IonRefresher,
    IonRefresherContent,
    TranslatePipe,
    DateDmyPipe,
    SkeletonListComponent,
  ],
})
export class ParentChildDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly children = inject(ChildrenService);
  private readonly departments = inject(DepartmentsService);
  private readonly parents = inject(ParentsService);
  private readonly absences = inject(AbsencesService);
  private readonly kindergartens = inject(KindergartensService);
  private readonly schedules = inject(SchedulesService);
  private readonly documentsService = inject(DocumentsService);
  private readonly fb = inject(FormBuilder);
  private readonly t = inject(TranslateService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly modalCtrl = inject(ModalController);

  protected readonly onRefresh = completeRefresher;

  readonly listUrl = computed(() => {
    const url = this.router.url;
    const idx = url.lastIndexOf('/');
    return idx > 0 ? url.slice(0, idx) : '/';
  });

  readonly childId = toSignal(
    this.route.paramMap.pipe(switchMap((p) => of(p.get('id')))),
    { initialValue: null as string | null },
  );

  readonly parent = this.parents.currentParent;
  private readonly parentId = computed(() => this.parent()?.id ?? null);
  private readonly kgId = computed(() => this.parent()?.kindergartenId ?? null);

  private readonly myChildren = toSignal(
    toObservable(this.parentId).pipe(
      switchMap((pid) => (pid ? this.children.forParent(pid) : of<Child[]>([]))),
    ),
    { initialValue: [] as Child[] },
  );

  private readonly kgDepartments = toSignal(
    toObservable(this.kgId).pipe(
      switchMap((id) =>
        id ? this.departments.forKindergarten(id) : of<Department[]>([]),
      ),
    ),
    { initialValue: [] as Department[] },
  );

  readonly child = computed(() => {
    const id = this.childId();
    if (!id) return null;
    return this.myChildren().find((c) => c.id === id) ?? null;
  });

  readonly documents = toSignal(
    toObservable(this.childId).pipe(
      switchMap((id) => (id ? this.documentsService.forChild(id) : of<ChildDocument[]>([]))),
    ),
    { initialValue: [] as ChildDocument[] },
  );

  readonly departmentName = computed(() => {
    const deptId = this.child()?.departmentId;
    if (!deptId) return null;
    return this.kgDepartments().find((d) => d.id === deptId)?.name ?? null;
  });

  readonly childAge = computed<number | null>(() => {
    const c = this.child();
    if (!c?.birthDate) return null;
    const birth = new Date(c.birthDate);
    if (Number.isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age >= 0 ? age : null;
  });

  readonly childAbsences = toSignal(
    toObservable(this.childId).pipe(
      switchMap((id) => (id ? this.absences.forChild(id) : of<Absence[]>([]))),
    ),
    { initialValue: [] as Absence[] },
  );

  readonly todayStr = computed(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  readonly todaySickAbsence = computed<Absence | null>(() => {
    const today = this.todayStr();
    return (
      this.childAbsences().find(
        (a) => a.type === 'sick' && a.startDate <= today && a.endDate >= today,
      ) ?? null
    );
  });

  readonly isSickToday = computed(() => !!this.todaySickAbsence());

  readonly upcomingHolidays = computed(() => {
    const today = this.todayStr();
    return this.childAbsences()
      .filter((a) => a.type === 'holiday' && a.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  });

  readonly history = computed(() =>
    this.childAbsences()
      .slice()
      .sort((a, b) => b.startDate.localeCompare(a.startDate)),
  );

  readonly holidayForm = this.fb.nonNullable.group({
    startDate: ['', [Validators.required]],
    endDate: ['', [Validators.required]],
  });

  onHolidayStartChange(event: CustomEvent<DatetimeChangeEventDetail>): void {
    const v = event.detail.value;
    if (typeof v === 'string') {
      this.holidayForm.controls.startDate.setValue(v.slice(0, 10));
      this.holidayForm.controls.startDate.markAsDirty();
    }
  }

  onHolidayEndChange(event: CustomEvent<DatetimeChangeEventDetail>): void {
    const v = event.detail.value;
    if (typeof v === 'string') {
      this.holidayForm.controls.endDate.setValue(v.slice(0, 10));
      this.holidayForm.controls.endDate.markAsDirty();
    }
  }

  protected readonly weekDays = WEEK_DAYS;

  readonly loading = signal(true);

  readonly operatingHours = computed<OperatingHours>(() =>
    getOperatingHours(this.kindergartens.current()),
  );
  readonly scheduleDraft = signal<WeeklySchedule>(defaultScheduleFor(DEFAULT_OPERATING_HOURS));
  readonly scheduleDirty = signal(false);

  private readonly storedSchedule = toSignal(
    toObservable(this.childId).pipe(
      switchMap((id) => (id ? this.schedules.forChild(id) : of<WeeklySchedule | null>(null))),
    ),
    { initialValue: null as WeeklySchedule | null },
  );

  constructor() {
    addIcons({
      'add-outline': addOutline,
      'bandage-outline': bandageOutline,
      'business-outline': businessOutline,
      'calendar-outline': calendarOutline,
      'document-outline': documentOutline,
      'download-outline': downloadOutline,
      'female-outline': femaleOutline,
      'happy-outline': happyOutline,
      'hourglass-outline': hourglassOutline,
      'male-outline': maleOutline,
      'sunny-outline': sunnyOutline,
      'time-outline': timeOutline,
      'trash-outline': trashOutline,
    });
    effect(() => {
      if (this.myChildren().length > 0) this.loading.set(false);
    });
    effect(() => {
      const stored = this.storedSchedule();
      const hours = this.operatingHours();
      if (!this.scheduleDirty()) {
        this.scheduleDraft.set(getWeeklySchedule(stored, hours));
      }
    });
    setTimeout(() => this.loading.set(false), 1500);
  }

  toggleAttending(day: WeekDay, event: CustomEvent): void {
    const checked = !!(event.detail as { checked?: boolean }).checked;
    const hours = this.operatingHours()[day];
    if (!hours.open) return;
    const next: WeeklySchedule = { ...this.scheduleDraft() };
    const cur = next[day];
    next[day] = checked
      ? { attending: true, arrival: cur.arrival || hours.from, departure: cur.departure || hours.to }
      : { ...cur, attending: false };
    this.scheduleDraft.set(next);
    this.scheduleDirty.set(true);
  }

  onScheduleTimeChange(day: WeekDay, field: 'arrival' | 'departure', event: CustomEvent): void {
    const raw = (event.detail as { value?: string | null }).value;
    if (typeof raw !== 'string') return;
    const time = extractHm(raw);
    if (!time) return;
    const hours = this.operatingHours()[day];
    if (!hours.open) return;
    const clamped =
      field === 'arrival'
        ? time < hours.from
          ? hours.from
          : time
        : time > hours.to
          ? hours.to
          : time;
    const next: WeeklySchedule = { ...this.scheduleDraft() };
    next[day] = { ...next[day], [field]: clamped };
    this.scheduleDraft.set(next);
    this.scheduleDirty.set(true);
  }

  async saveSchedule(): Promise<void> {
    const c = this.child();
    if (!c) return;
    await this.schedules.update(c.id, this.scheduleDraft());
    this.scheduleDirty.set(false);
    await this.toast('parent.children.detail.scheduleSaved', 'success');
  }

  async toggleSickToday(event: CustomEvent): Promise<void> {
    const checked = !!(event.detail as { checked?: boolean }).checked;
    const c = this.child();
    if (!c) return;

    if (checked && !this.todaySickAbsence()) {
      const today = this.todayStr();
      await this.absences.add({
        childId: c.id,
        kindergartenId: c.kindergartenId,
        type: 'sick',
        startDate: today,
        endDate: today,
        note: '',
      });
      return;
    }
    if (!checked) {
      const existing = this.todaySickAbsence();
      if (existing) {
        await this.absences.remove(existing.id);
      }
    }
  }

  async addHoliday(): Promise<void> {
    if (this.holidayForm.invalid) {
      this.holidayForm.markAllAsTouched();
      return;
    }
    const c = this.child();
    if (!c) return;
    // ion-datetime may emit full ISO (yyyy-mm-ddTHH:mm:ss). Normalize to date-only.
    const raw = this.holidayForm.getRawValue();
    const startDate = raw.startDate.slice(0, 10);
    const endDate = raw.endDate.slice(0, 10);
    const today = this.todayStr();

    if (endDate < startDate) {
      await this.toast('parent.children.detail.errors.endBeforeStart', 'danger');
      return;
    }
    if (startDate < today) {
      await this.toast('parent.children.detail.errors.startInPast', 'danger');
      return;
    }

    await this.absences.add({
      childId: c.id,
      kindergartenId: c.kindergartenId,
      type: 'holiday',
      startDate,
      endDate,
      note: '',
    });
    this.holidayForm.reset({ startDate: '', endDate: '' });
  }

  async removeAbsence(abs: Absence): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.t.instant('common.confirmDeleteTitle'),
      message: this.t.instant('parent.absence.confirmDelete'),
      buttons: [
        { text: this.t.instant('common.cancel'), role: 'cancel' },
        {
          text: this.t.instant('common.delete'),
          role: 'destructive',
          handler: () => {
            this.absences.remove(abs.id);
          },
        },
      ],
    });
    await alert.present();
  }

  async openHistory(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: AbsenceHistoryModal,
      componentProps: { history: this.history() },
    });
    await modal.present();
  }

  private async toast(messageKey: string, color: 'success' | 'danger' | 'medium' = 'medium'): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: this.t.instant(messageKey),
      duration: 2200,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}

function extractHm(value: string): string | null {
  const match = value.match(/(\d{2}:\d{2})/);
  return match ? match[1] : null;
}

import { Component, Input, OnInit, inject, signal } from '@angular/core';
import {
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
  IonModal,
  IonTitle,
  IonToggle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, hourglassOutline, timeOutline } from 'ionicons/icons';
import { TranslatePipe } from '@ngx-translate/core';
import {
  DEFAULT_OPERATING_HOURS,
  OperatingHours,
  WEEK_DAYS,
  WeekDay,
  WeeklySchedule,
  defaultScheduleFor,
} from '@app/data/schedule';

@Component({
  selector: 'app-weekly-schedule-modal',
  templateUrl: 'weekly-schedule.modal.html',
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
    IonToggle,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    TranslatePipe,
  ],
})
export class WeeklyScheduleModal implements OnInit {
  private readonly modalCtrl = inject(ModalController);

  @Input() operatingHours: OperatingHours = DEFAULT_OPERATING_HOURS;
  @Input() schedule: WeeklySchedule = defaultScheduleFor(DEFAULT_OPERATING_HOURS);

  readonly draft = signal<WeeklySchedule>(defaultScheduleFor(DEFAULT_OPERATING_HOURS));
  readonly weekDays = WEEK_DAYS;

  constructor() {
    addIcons({
      'close-outline': closeOutline,
      'time-outline': timeOutline,
      'hourglass-outline': hourglassOutline,
    });
  }

  ngOnInit(): void {
    this.draft.set(this.schedule);
  }

  toggleAttending(day: WeekDay, event: CustomEvent): void {
    const checked = !!(event.detail as { checked?: boolean }).checked;
    const hours = this.operatingHours[day];
    if (!hours.open) return;
    const next: WeeklySchedule = { ...this.draft() };
    const cur = next[day];
    next[day] = checked
      ? { attending: true, arrival: cur.arrival || hours.from, departure: cur.departure || hours.to }
      : { ...cur, attending: false };
    this.draft.set(next);
  }

  onTimeChange(day: WeekDay, field: 'arrival' | 'departure', event: CustomEvent): void {
    const raw = (event.detail as { value?: string | null }).value;
    if (typeof raw !== 'string') return;
    const time = extractHm(raw);
    if (!time) return;
    const hours = this.operatingHours[day];
    if (!hours.open) return;
    const clamped =
      field === 'arrival'
        ? time < hours.from
          ? hours.from
          : time
        : time > hours.to
          ? hours.to
          : time;
    const next: WeeklySchedule = { ...this.draft() };
    next[day] = { ...next[day], [field]: clamped };
    this.draft.set(next);
  }

  cancel(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  save(): void {
    this.modalCtrl.dismiss(this.draft(), 'confirm');
  }
}

function extractHm(value: string): string | null {
  const match = value.match(/(\d{2}:\d{2})/);
  return match ? match[1] : null;
}

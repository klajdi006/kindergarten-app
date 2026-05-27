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
import { closeOutline, timeOutline } from 'ionicons/icons';
import { TranslatePipe } from '@ngx-translate/core';
import {
  DEFAULT_OPEN_HOURS,
  DEFAULT_OPERATING_HOURS,
  OperatingHours,
  WEEK_DAYS,
  WeekDay,
} from '@app/data/schedule';

@Component({
  selector: 'app-operating-hours-modal',
  templateUrl: 'operating-hours.modal.html',
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
export class OperatingHoursModal implements OnInit {
  private readonly modalCtrl = inject(ModalController);

  @Input() operatingHours: OperatingHours = DEFAULT_OPERATING_HOURS;

  readonly draft = signal<OperatingHours>(DEFAULT_OPERATING_HOURS);
  readonly weekDays = WEEK_DAYS;

  constructor() {
    addIcons({ 'close-outline': closeOutline, 'time-outline': timeOutline });
  }

  ngOnInit(): void {
    this.draft.set(this.operatingHours);
  }

  toggleDayOpen(day: WeekDay, event: CustomEvent): void {
    const checked = !!(event.detail as { checked?: boolean }).checked;
    const next: OperatingHours = { ...this.draft() };
    next[day] = checked ? { ...DEFAULT_OPEN_HOURS } : { open: false };
    this.draft.set(next);
  }

  onTimeChange(day: WeekDay, field: 'from' | 'to', event: CustomEvent): void {
    const raw = (event.detail as { value?: string | null }).value;
    if (typeof raw !== 'string') return;
    const time = extractHm(raw);
    if (!time) return;
    const cur = this.draft()[day];
    if (!cur.open) return;
    const next: OperatingHours = { ...this.draft() };
    next[day] = { ...cur, [field]: time };
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
  // ion-datetime emits either 'HH:mm' / 'HH:mm:ss' or a full ISO 'YYYY-MM-DDTHH:mm:ss'.
  const match = value.match(/(\d{2}:\d{2})/);
  return match ? match[1] : null;
}

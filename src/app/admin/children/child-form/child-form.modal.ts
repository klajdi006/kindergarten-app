import { Component, Input, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  DatetimeChangeEventDetail,
  IonButton,
  IonButtons,
  IonContent,
  IonDatetime,
  IonDatetimeButton,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { DateDmyPipe } from '@app/shared/pipes/date-dmy.pipe';
import { Child, ChildGender, Department } from '@app/data/types';

export interface ChildFormResult {
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: ChildGender;
  departmentId: string | null;
  tariff: number;
}

@Component({
  selector: 'app-child-form-modal',
  templateUrl: 'child-form.modal.html',
  imports: [
    ReactiveFormsModule,
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
    IonInput,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    IonSelect,
    IonSelectOption,
    TranslatePipe,
  ],
})
export class ChildFormModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly modalCtrl = inject(ModalController);

  @Input() child: Child | null = null;
  @Input() departments: Department[] = [];

  constructor() {
    addIcons({ 'close-outline': closeOutline });
  }

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    birthDate: ['', [Validators.required]],
    gender: ['', [Validators.required]],
    departmentId: [''],
    tariff: [0, [Validators.required, Validators.min(0)]],
  });

  readonly todayIso = todayIso();

  get isEdit(): boolean {
    return !!this.child;
  }

  ngOnInit(): void {
    if (this.child) {
      this.form.patchValue({
        firstName: this.child.firstName,
        lastName: this.child.lastName,
        birthDate: this.child.birthDate,
        gender: this.child.gender,
        departmentId: this.child.departmentId ?? '',
        tariff: this.child.tariff ?? 0,
      });
    }
  }

  onBirthDateChange(event: CustomEvent<DatetimeChangeEventDetail>): void {
    const v = event.detail.value;
    if (typeof v === 'string') {
      this.form.controls.birthDate.setValue(v.slice(0, 10));
      this.form.controls.birthDate.markAsDirty();
    }
  }

  cancel(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { firstName, lastName, birthDate, gender, departmentId, tariff } = this.form.getRawValue();
    const result: ChildFormResult = {
      firstName,
      lastName,
      birthDate: (birthDate ?? '').slice(0, 10),
      gender: gender as ChildGender,
      departmentId: departmentId || null,
      tariff: Number(tariff) || 0,
    };
    this.modalCtrl.dismiss(result, 'confirm');
  }
}

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

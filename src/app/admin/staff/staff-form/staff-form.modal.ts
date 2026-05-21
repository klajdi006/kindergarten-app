import { Component, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { DepartmentsService } from '@app/data/departments.service';
import { StaffInput } from '@app/data/staff.service';

export type StaffFormResult = StaffInput;

const ALL = '__all__';

@Component({
  selector: 'app-staff-form-modal',
  templateUrl: 'staff-form.modal.html',
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
    IonInput,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonText,
    TranslatePipe,
  ],
})
export class StaffFormModal {
  private readonly fb = inject(FormBuilder);
  private readonly modalCtrl = inject(ModalController);
  readonly departments = inject(DepartmentsService);

  protected readonly ALL = ALL;

  constructor() {
    addIcons({ 'close-outline': closeOutline });
  }

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    role: ['employee' as 'admin' | 'employee', [Validators.required]],
    allDepartments: [false],
    departmentIds: [[] as string[]],
  });

  readonly isEmployee = computed(() => this.form.controls.role.value === 'employee');

  /** What the ion-select shows: ['__all__'] when allDepartments, else departmentIds. */
  readonly departmentsValue = computed<string[]>(() =>
    this.form.controls.allDepartments.value
      ? [ALL]
      : this.form.controls.departmentIds.value,
  );

  onDepartmentsChange(event: CustomEvent): void {
    const next = ((event.detail as { value?: string[] }).value ?? []).slice();
    const wasAll = this.form.controls.allDepartments.value;
    const hasAll = next.includes(ALL);

    if (wasAll && hasAll && next.length > 1) {
      // Was "all" — user just picked a specific dept too. Drop "all".
      this.form.patchValue({
        allDepartments: false,
        departmentIds: next.filter((v) => v !== ALL),
      });
    } else if (!wasAll && hasAll) {
      // User just picked "all" — clear specifics.
      this.form.patchValue({ allDepartments: true, departmentIds: [] });
    } else {
      this.form.patchValue({
        allDepartments: false,
        departmentIds: next.filter((v) => v !== ALL),
      });
    }
    this.form.markAsDirty();
  }

  cancel(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const result: StaffFormResult = {
      firstName: raw.firstName,
      lastName: raw.lastName,
      email: raw.email,
      phone: raw.phone,
      role: raw.role,
      departmentIds: raw.role === 'admin' ? [] : raw.departmentIds,
      allDepartments: raw.role === 'admin' ? true : raw.allDepartments,
    };
    this.modalCtrl.dismiss(result, 'confirm');
  }
}

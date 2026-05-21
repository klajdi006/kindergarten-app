import { Component, Input, OnInit, inject } from '@angular/core';
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
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { Department } from '@app/data/types';

export interface DepartmentFormResult {
  name: string;
  ageMin: number;
  ageMax: number;
}

@Component({
  selector: 'app-department-form-modal',
  templateUrl: 'department-form.modal.html',
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
    TranslatePipe,
  ],
})
export class DepartmentFormModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly modalCtrl = inject(ModalController);

  @Input() department: Department | null = null;

  constructor() {
    addIcons({ 'close-outline': closeOutline });
  }

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    ageMin: [0, [Validators.required, Validators.min(0), Validators.max(18)]],
    ageMax: [6, [Validators.required, Validators.min(0), Validators.max(18)]],
  });

  get isEdit(): boolean {
    return !!this.department;
  }

  ngOnInit(): void {
    if (this.department) {
      this.form.patchValue({
        name: this.department.name,
        ageMin: this.department.ageMin,
        ageMax: this.department.ageMax,
      });
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
    const result: DepartmentFormResult = this.form.getRawValue();
    this.modalCtrl.dismiss(result, 'confirm');
  }
}

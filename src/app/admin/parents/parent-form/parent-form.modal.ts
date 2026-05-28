import { Component, inject } from '@angular/core';
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

export interface ParentFormResult {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: 'male' | 'female' | null;
}

@Component({
  selector: 'app-parent-form-modal',
  templateUrl: 'parent-form.modal.html',
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
export class ParentFormModal {
  private readonly fb = inject(FormBuilder);
  private readonly modalCtrl = inject(ModalController);

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    gender: ['' as 'male' | 'female' | ''],
  });

  constructor() {
    addIcons({ 'close-outline': closeOutline });
  }

  cancel(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { firstName, lastName, email, phone, gender } = this.form.getRawValue();
    this.modalCtrl.dismiss(
      { firstName, lastName, email, phone, gender: gender || null } satisfies ParentFormResult,
      'confirm',
    );
  }
}

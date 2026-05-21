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
  IonSelect,
  IonSelectOption,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, globeOutline } from 'ionicons/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { Department } from '@app/data/types';

export interface PostFormResult {
  title: string;
  description: string;
  departmentId: string | null;
}

@Component({
  selector: 'app-post-form-modal',
  templateUrl: 'post-form.modal.html',
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonNote,
    IonIcon,
    IonText,
    TranslatePipe,
  ],
})
export class PostFormModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly modalCtrl = inject(ModalController);

  @Input() departments: Department[] = [];

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    description: ['', [Validators.required]],
    departmentId: [''],
  });

  protected readonly globeOutline = globeOutline;

  constructor() {
    addIcons({ 'close-outline': closeOutline });
  }

  ngOnInit(): void {}

  cancel(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { title, description, departmentId } = this.form.getRawValue();
    const result: PostFormResult = {
      title,
      description,
      departmentId: departmentId || null,
    };
    this.modalCtrl.dismiss(result, 'confirm');
  }
}

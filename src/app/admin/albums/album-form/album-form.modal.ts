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
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { Album, Department } from '@app/data/types';

export interface AlbumFormResult {
  name: string;
  departmentId: string;
}

@Component({
  selector: 'app-album-form-modal',
  templateUrl: 'album-form.modal.html',
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
    TranslatePipe,
  ],
})
export class AlbumFormModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly modalCtrl = inject(ModalController);

  @Input() album: Album | null = null;
  @Input() departments: Department[] = [];

  constructor() {
    addIcons({ 'close-outline': closeOutline });
  }

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    departmentId: ['', [Validators.required]],
  });

  get isEdit(): boolean {
    return !!this.album;
  }

  ngOnInit(): void {
    if (this.album) {
      this.form.patchValue({
        name: this.album.name,
        departmentId: this.album.departmentId,
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
    this.modalCtrl.dismiss(this.form.getRawValue() as AlbumFormResult, 'confirm');
  }
}

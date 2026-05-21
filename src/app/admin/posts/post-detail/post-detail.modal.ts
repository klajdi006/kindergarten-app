import { Component, Input, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, globeOutline, trashOutline } from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DateDmyPipe } from '@app/shared/pipes/date-dmy.pipe';
import { Department, Post } from '@app/data/types';

export interface PostUpdateResult {
  title: string;
  description: string;
  departmentId: string | null;
}

@Component({
  selector: 'app-post-detail-modal',
  templateUrl: 'post-detail.modal.html',
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonIcon,
    IonText,
    TranslatePipe,
    DateDmyPipe,
  ],
})
export class PostDetailModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly t = inject(TranslateService);

  @Input({ required: true }) post!: Post;
  @Input() departments: Department[] = [];
  @Input() canEdit = true;

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    description: ['', [Validators.required]],
    departmentId: [''],
  });

  readonly saving = signal(false);
  readonly currentPost = signal<Post | null>(null);

  protected readonly globeOutline = globeOutline;
  protected readonly trashOutline = trashOutline;

  constructor() {
    addIcons({ 'close-outline': closeOutline });
  }

  ngOnInit(): void {
    this.currentPost.set(this.post);
    this.form.patchValue({
      title: this.post.title,
      description: this.post.description,
      departmentId: this.post.departmentId ?? '',
    });
    this.form.markAsPristine();
    if (!this.canEdit) {
      this.form.disable();
    }
  }

  cancel(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  save(): void {
    if (this.form.invalid || this.form.pristine) {
      this.form.markAllAsTouched();
      return;
    }
    const { title, description, departmentId } = this.form.getRawValue();
    const result: PostUpdateResult = {
      title,
      description,
      departmentId: departmentId || null,
    };
    this.modalCtrl.dismiss({ action: 'update', payload: result }, 'confirm');
  }

  async requestDelete(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.t.instant('common.confirmDeleteTitle'),
      message: this.t.instant('common.confirmDeleteMessage', { name: this.post.title }),
      buttons: [
        { text: this.t.instant('common.cancel'), role: 'cancel' },
        {
          text: this.t.instant('common.delete'),
          role: 'destructive',
          handler: () => {
            this.modalCtrl.dismiss({ action: 'delete' }, 'confirm');
          },
        },
      ],
    });
    await alert.present();
  }

}

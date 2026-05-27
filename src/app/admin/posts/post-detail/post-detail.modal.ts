import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
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
import {
  alertCircleOutline,
  closeOutline,
  documentOutline,
  globeOutline,
  imagesOutline,
  trashOutline,
} from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Department, Photo, Post, PostAttachment } from '@app/data/types';
import { PostsService } from '@app/data/posts.service';
import { DateDmyPipe } from '@app/shared/pipes/date-dmy.pipe';
import { PhotoViewerModal } from '@app/shared/components/photo-viewer/photo-viewer.modal';

export interface PostUpdateResult {
  title: string;
  description: string;
  departmentId: string | null;
  imageUrls: string[];
  imagePaths: string[];
  attachments: PostAttachment[];
}

interface EditImage {
  id: string;
  url?: string;
  path?: string;
  previewUrl?: string;
  progress: number;
  failed: boolean;
}

interface EditFile {
  id: string;
  name: string;
  url?: string;
  path?: string;
  progress: number;
  failed: boolean;
}

@Component({
  selector: 'app-post-detail-modal',
  templateUrl: 'post-detail.modal.html',
  styleUrl: './post-detail.modal.scss',
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
    IonNote,
    TranslatePipe,
    DateDmyPipe,
  ],
})
export class PostDetailModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly t = inject(TranslateService);
  private readonly posts = inject(PostsService);

  @Input({ required: true }) post!: Post;
  @Input() departments: Department[] = [];
  @Input() canEdit = true;

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    description: ['', [Validators.required]],
    departmentId: [''],
  });

  readonly saving = signal(false);
  readonly images = signal<EditImage[]>([]);
  readonly files = signal<EditFile[]>([]);
  /** Persisted media paths removed during this edit — deleted from storage on save. */
  private readonly removedPaths = signal<string[]>([]);
  private mediaDirty = false;

  protected readonly RING_C = 2 * Math.PI * 16;

  constructor() {
    addIcons({
      'close-outline': closeOutline,
      'globe-outline': globeOutline,
      'images-outline': imagesOutline,
      'document-outline': documentOutline,
      'trash-outline': trashOutline,
      'alert-circle-outline': alertCircleOutline,
    });
    inject(DestroyRef).onDestroy(() => {
      for (const img of this.images()) {
        if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
      }
    });
  }

  ngOnInit(): void {
    this.form.patchValue({
      title: this.post.title,
      description: this.post.description,
      departmentId: this.post.departmentId ?? '',
    });
    this.form.markAsPristine();

    const urls = this.post.imageUrls ?? [];
    const paths = this.post.imagePaths ?? [];
    this.images.set(
      urls.map((url, i) => ({
        id: `e${i}`,
        url,
        path: paths[i],
        progress: 1,
        failed: false,
      })),
    );
    this.files.set(
      (this.post.attachments ?? []).map((a, i) => ({
        id: `f${i}`,
        name: a.name,
        url: a.url,
        path: a.path,
        progress: 1,
        failed: false,
      })),
    );

    if (!this.canEdit) this.form.disable();
  }

  ringOffset(progress: number): number {
    return this.RING_C * (1 - progress);
  }

  pct(progress: number): number {
    return Math.round(progress * 100);
  }

  private rid(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  onImagesPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = input.files ? Array.from(input.files) : [];
    input.value = '';
    for (const file of picked) {
      const entry: EditImage = {
        id: this.rid(),
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        failed: false,
      };
      this.images.update((l) => [...l, entry]);
      this.mediaDirty = true;
      void this.uploadImage(file, entry.id);
    }
  }

  onFilesPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = input.files ? Array.from(input.files) : [];
    input.value = '';
    for (const file of picked) {
      const entry: EditFile = { id: this.rid(), name: file.name, progress: 0, failed: false };
      this.files.update((l) => [...l, entry]);
      this.mediaDirty = true;
      void this.uploadFile(file, entry.id);
    }
  }

  private async uploadImage(file: File, id: string): Promise<void> {
    try {
      const { url, path } = await this.posts.uploadImage(file, (f) =>
        this.images.update((l) => l.map((i) => (i.id === id ? { ...i, progress: f } : i))),
      );
      this.images.update((l) =>
        l.map((i) => (i.id === id ? { ...i, progress: 1, url, path } : i)),
      );
    } catch (err) {
      console.error('[posts] image upload failed', err);
      this.images.update((l) => l.map((i) => (i.id === id ? { ...i, failed: true } : i)));
    }
  }

  private async uploadFile(file: File, id: string): Promise<void> {
    try {
      const att = await this.posts.uploadFile(file, (f) =>
        this.files.update((l) => l.map((x) => (x.id === id ? { ...x, progress: f } : x))),
      );
      this.files.update((l) =>
        l.map((x) => (x.id === id ? { ...x, progress: 1, url: att.url, path: att.path } : x)),
      );
    } catch {
      this.files.update((l) => l.map((x) => (x.id === id ? { ...x, failed: true } : x)));
    }
  }

  removeImage(id: string): void {
    const img = this.images().find((i) => i.id === id);
    if (img) {
      if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
      if (img.path) {
        // Newly uploaded (has previewUrl) → delete now; persisted → defer to save.
        if (img.previewUrl) void this.posts.deleteMedia([img.path]);
        else this.removedPaths.update((p) => [...p, img.path as string]);
      }
    }
    this.images.update((l) => l.filter((i) => i.id !== id));
    this.mediaDirty = true;
  }

  removeFile(id: string): void {
    const f = this.files().find((x) => x.id === id);
    if (f?.path) {
      if (f.url && this.isNewUpload(f)) void this.posts.deleteMedia([f.path]);
      else this.removedPaths.update((p) => [...p, f.path as string]);
    }
    this.files.update((l) => l.filter((x) => x.id !== id));
    this.mediaDirty = true;
  }

  private isNewUpload(f: EditFile): boolean {
    return !(this.post.attachments ?? []).some((a) => a.path === f.path);
  }

  async openImage(img: EditImage): Promise<void> {
    if (!img.url) return;
    const ready = this.images().filter((i) => i.url);
    const startIndex = Math.max(0, ready.findIndex((i) => i.id === img.id));
    const photos: Photo[] = ready.map((i, n) => ({
      id: `${n}`,
      downloadUrl: i.url as string,
    })) as Photo[];
    const modal = await this.modalCtrl.create({
      component: PhotoViewerModal,
      componentProps: { photos, startIndex },
    });
    await modal.present();
  }

  get uploading(): boolean {
    return (
      this.images().some((i) => !i.failed && !i.url) ||
      this.files().some((f) => !f.failed && !f.url)
    );
  }

  get canSave(): boolean {
    return (!this.form.pristine || this.mediaDirty) && this.form.valid && !this.uploading;
  }

  cancel(): void {
    // Drop newly uploaded-but-unsaved media.
    const newPaths = [
      ...this.images().filter((i) => i.previewUrl && i.path).map((i) => i.path as string),
      ...this.files().filter((f) => this.isNewUpload(f) && f.path).map((f) => f.path as string),
    ];
    if (newPaths.length > 0) void this.posts.deleteMedia(newPaths);
    this.modalCtrl.dismiss(null, 'cancel');
  }

  async save(): Promise<void> {
    if (!this.canSave) {
      this.form.markAllAsTouched();
      return;
    }
    // Purge media the user removed during this edit.
    const removed = this.removedPaths();
    if (removed.length > 0) await this.posts.deleteMedia(removed);

    const { title, description, departmentId } = this.form.getRawValue();
    const readyImages = this.images().filter((i) => i.url && i.path);
    const readyFiles = this.files().filter((f) => f.url && f.path);
    const result: PostUpdateResult = {
      title,
      description,
      departmentId: departmentId || null,
      imageUrls: readyImages.map((i) => i.url as string),
      imagePaths: readyImages.map((i) => i.path as string),
      attachments: readyFiles.map((f) => ({
        name: f.name,
        url: f.url as string,
        path: f.path as string,
      })),
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

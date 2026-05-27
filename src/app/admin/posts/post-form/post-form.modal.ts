import { Component, DestroyRef, Input, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
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
  cloudUploadOutline,
  documentOutline,
  globeOutline,
  imagesOutline,
  trashOutline,
} from 'ionicons/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { Department, PostAttachment } from '@app/data/types';
import { PostsService } from '@app/data/posts.service';

export interface PostFormResult {
  title: string;
  description: string;
  departmentId: string | null;
  imageUrls: string[];
  imagePaths: string[];
  attachments: PostAttachment[];
}

interface PendingImage {
  id: string;
  previewUrl: string;
  progress: number;
  failed: boolean;
  url?: string;
  path?: string;
}

interface PendingFile {
  id: string;
  name: string;
  progress: number;
  failed: boolean;
  url?: string;
  path?: string;
}

@Component({
  selector: 'app-post-form-modal',
  templateUrl: 'post-form.modal.html',
  styleUrl: './post-form.modal.scss',
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
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonNote,
    IonIcon,
    IonText,
    IonLabel,
    TranslatePipe,
  ],
})
export class PostFormModal {
  private readonly fb = inject(FormBuilder);
  private readonly modalCtrl = inject(ModalController);
  private readonly posts = inject(PostsService);

  @Input() departments: Department[] = [];

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    description: ['', [Validators.required]],
    departmentId: [''],
  });

  readonly images = signal<PendingImage[]>([]);
  readonly files = signal<PendingFile[]>([]);

  /** Disable Save while any upload is still running. */
  readonly busy = signal(false);

  protected readonly RING_C = 2 * Math.PI * 16;

  constructor() {
    addIcons({
      'close-outline': closeOutline,
      'cloud-upload-outline': cloudUploadOutline,
      'globe-outline': globeOutline,
      'images-outline': imagesOutline,
      'document-outline': documentOutline,
      'trash-outline': trashOutline,
      'alert-circle-outline': alertCircleOutline,
    });
    inject(DestroyRef).onDestroy(() => {
      for (const img of this.images()) URL.revokeObjectURL(img.previewUrl);
    });
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
      const entry: PendingImage = {
        id: this.rid(),
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        failed: false,
      };
      this.images.update((l) => [...l, entry]);
      void this.uploadImage(file, entry.id);
    }
  }

  onFilesPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = input.files ? Array.from(input.files) : [];
    input.value = '';
    for (const file of picked) {
      const entry: PendingFile = {
        id: this.rid(),
        name: file.name,
        progress: 0,
        failed: false,
      };
      this.files.update((l) => [...l, entry]);
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
      URL.revokeObjectURL(img.previewUrl);
      if (img.path) void this.posts.deleteMedia([img.path]);
    }
    this.images.update((l) => l.filter((i) => i.id !== id));
  }

  removeFile(id: string): void {
    const f = this.files().find((x) => x.id === id);
    if (f?.path) void this.posts.deleteMedia([f.path]);
    this.files.update((l) => l.filter((x) => x.id !== id));
  }

  cancel(): void {
    // Clean up anything already uploaded but not saved.
    const paths = [
      ...this.images().map((i) => i.path),
      ...this.files().map((f) => f.path),
    ].filter((p): p is string => !!p);
    if (paths.length > 0) void this.posts.deleteMedia(paths);
    this.modalCtrl.dismiss(null, 'cancel');
  }

  get uploading(): boolean {
    // "Done" means the download URL is resolved — not merely that bytes
    // finished transferring (progress hits 1 before getDownloadURL resolves).
    return (
      this.images().some((i) => !i.failed && !i.url) ||
      this.files().some((f) => !f.failed && !f.url)
    );
  }

  save(): void {
    if (this.form.invalid || this.uploading) {
      this.form.markAllAsTouched();
      return;
    }
    const { title, description, departmentId } = this.form.getRawValue();
    const readyImages = this.images().filter((i) => i.url && i.path);
    const readyFiles = this.files().filter((f) => f.url && f.path);
    const result: PostFormResult = {
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
    this.modalCtrl.dismiss(result, 'confirm');
  }
}

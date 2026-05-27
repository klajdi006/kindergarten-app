import { Component, Input, OnInit, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  AlertController,
  DatetimeChangeEventDetail,
  IonAvatar,
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
  IonListHeader,
  IonModal,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  closeCircleOutline,
  closeOutline,
  cloudUploadOutline,
  documentOutline,
  downloadOutline,
  personAddOutline,
  trashOutline,
} from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { of, switchMap } from 'rxjs';
import {
  AssignParentsModal,
  AssignParentsResult,
} from '@app/admin/children/assign-parents/assign-parents.modal';
import { ChildrenService } from '@app/data/children.service';
import { DepartmentsService } from '@app/data/departments.service';
import { DocumentsService } from '@app/data/documents.service';
import { ParentsService } from '@app/data/parents.service';
import { Child, ChildDocument, ChildGender, Parent } from '@app/data/types';
import { DateDmyPipe } from '@app/shared/pipes/date-dmy.pipe';

interface DocUpload {
  id: string;
  name: string;
  progress: number;
  failed: boolean;
}

@Component({
  selector: 'app-child-detail-modal',
  templateUrl: 'child-detail.modal.html',
  styleUrl: './child-detail.modal.scss',
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
    IonAvatar,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    IonIcon,
    IonText,
    IonNote,
    TranslatePipe,
    DateDmyPipe,
  ],
})
export class ChildDetailModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly t = inject(TranslateService);
  readonly children = inject(ChildrenService);
  readonly parents = inject(ParentsService);
  readonly departments = inject(DepartmentsService);
  readonly documentsService = inject(DocumentsService);

  @Input({ required: true }) childId!: string;

  private readonly childIdSig = signal<string | null>(null);

  readonly documents = toSignal(
    toObservable(this.childIdSig).pipe(
      switchMap((id) => (id ? this.documentsService.forChild(id) : of<ChildDocument[]>([]))),
    ),
    { initialValue: [] as ChildDocument[] },
  );

  readonly docUploads = signal<DocUpload[]>([]);

  readonly child = computed<Child | null>(
    () => this.children.all().find((c) => c.id === this.childId) ?? null,
  );

  readonly parentById = computed(() => {
    const map = new Map<string, Parent>();
    for (const p of this.parents.all()) map.set(p.id, p);
    return map;
  });

  readonly linkedParents = computed<Parent[]>(() => {
    const c = this.child();
    if (!c) return [];
    return c.parentIds.map((id) => this.parentById().get(id)).filter((p): p is Parent => !!p);
  });

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    birthDate: ['', [Validators.required]],
    gender: ['', [Validators.required]],
    departmentId: [''],
  });

  readonly saving = signal(false);

  readonly todayIso = todayIso();

  constructor() {
    addIcons({
      'close-outline': closeOutline,
      'close-circle-outline': closeCircleOutline,
      'person-add-outline': personAddOutline,
      'trash-outline': trashOutline,
      'document-outline': documentOutline,
      'cloud-upload-outline': cloudUploadOutline,
      'download-outline': downloadOutline,
    });
    effect(() => {
      const c = this.child();
      if (c && this.form.pristine) {
        this.form.patchValue(
          {
            firstName: c.firstName,
            lastName: c.lastName,
            birthDate: c.birthDate,
            gender: c.gender,
            departmentId: c.departmentId ?? '',
          },
          { emitEvent: false },
        );
      }
    });
  }

  ngOnInit(): void {
    this.childIdSig.set(this.childId);
    const c = this.child();
    if (c) {
      this.form.patchValue({
        firstName: c.firstName,
        lastName: c.lastName,
        birthDate: c.birthDate,
        gender: c.gender ?? '',
        departmentId: c.departmentId ?? '',
      });
      this.form.markAsPristine();
    }
  }

  initials(input: { firstName?: string; lastName?: string } | null | undefined): string {
    if (!input) return '?';
    return (
      [input.firstName?.[0], input.lastName?.[0]]
        .filter(Boolean)
        .join('')
        .toUpperCase() || '?'
    );
  }

  childAge(child: Child): number | null {
    if (!child.birthDate) return null;
    const birth = new Date(child.birthDate);
    if (Number.isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age >= 0 ? age : null;
  }

  onBirthDateChange(event: CustomEvent<DatetimeChangeEventDetail>): void {
    const v = event.detail.value;
    if (typeof v === 'string') {
      this.form.controls.birthDate.setValue(v.slice(0, 10));
      this.form.controls.birthDate.markAsDirty();
    }
  }

  close(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  async save(): Promise<void> {
    const c = this.child();
    if (!c || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const { firstName, lastName, birthDate, gender, departmentId } = this.form.getRawValue();
      await this.children.update(c.id, {
        firstName,
        lastName,
        birthDate: (birthDate ?? '').slice(0, 10),
        gender: gender as ChildGender,
        departmentId: departmentId || null,
      });
      this.form.markAsPristine();
    } finally {
      this.saving.set(false);
    }
  }

  async confirmDelete(): Promise<void> {
    const c = this.child();
    if (!c) return;
    const alert = await this.alertCtrl.create({
      header: this.t.instant('common.confirmDeleteTitle'),
      message: this.t.instant('common.confirmDeleteMessage', {
        name: `${c.firstName} ${c.lastName}`,
      }),
      buttons: [
        { text: this.t.instant('common.cancel'), role: 'cancel' },
        {
          text: this.t.instant('common.delete'),
          role: 'destructive',
          handler: async () => {
            await this.children.remove(c.id);
            await this.modalCtrl.dismiss({ deleted: true }, 'confirm');
          },
        },
      ],
    });
    await alert.present();
  }

  async openAssign(): Promise<void> {
    const c = this.child();
    if (!c) return;
    const available = this.parents.all().filter((p) => !c.parentIds.includes(p.id));
    if (available.length === 0) {
      await this.showToast('admin.children.noAvailableParents', 'medium');
      return;
    }
    const modal = await this.modalCtrl.create({
      component: AssignParentsModal,
      componentProps: { available },
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<AssignParentsResult>();
    if (role !== 'confirm' || !data?.selectedIds?.length) return;
    for (const id of data.selectedIds) {
      await this.parents.assignChild(id, c.id);
    }
    // Keep document access in sync with the new parent links.
    await this.documentsService.refreshAccessForChild(c.id, this.parents.all());
  }

  async unlink(parentId: string): Promise<void> {
    const c = this.child();
    if (!c) return;
    await this.parents.unassignChild(parentId, c.id);
    await this.documentsService.refreshAccessForChild(c.id, this.parents.all());
  }

  async onDocsPicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    const c = this.child();
    if (!c || files.length === 0) return;
    const parents = this.parents.all();

    for (const file of files) {
      const entry: DocUpload = {
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        progress: 0,
        failed: false,
      };
      this.docUploads.update((l) => [...l, entry]);
      try {
        await this.documentsService.upload(c, parents, file, (f) =>
          this.docUploads.update((l) =>
            l.map((u) => (u.id === entry.id ? { ...u, progress: f } : u)),
          ),
        );
        this.docUploads.update((l) => l.filter((u) => u.id !== entry.id));
      } catch (err) {
        console.error('[documents] upload failed', err);
        this.docUploads.update((l) =>
          l.map((u) => (u.id === entry.id ? { ...u, failed: true } : u)),
        );
      }
    }
  }

  dismissFailedDoc(id: string): void {
    this.docUploads.update((l) => l.filter((u) => u.id !== id));
  }

  async confirmDeleteDoc(document: ChildDocument): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.t.instant('common.confirmDeleteTitle'),
      message: this.t.instant('common.confirmDeleteMessage', { name: document.name }),
      buttons: [
        { text: this.t.instant('common.cancel'), role: 'cancel' },
        {
          text: this.t.instant('common.delete'),
          role: 'destructive',
          handler: () => {
            this.documentsService.remove(document);
          },
        },
      ],
    });
    await alert.present();
  }

  pct(progress: number): number {
    return Math.round(progress * 100);
  }

  private async showToast(
    key: string,
    color: 'success' | 'danger' | 'medium',
  ): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: this.t.instant(key),
      duration: 2500,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

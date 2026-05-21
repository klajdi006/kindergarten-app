import { Component, Input, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AlertController,
  IonAvatar,
  IonBadge,
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
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  callOutline,
  closeOutline,
  mailOutline,
  paperPlaneOutline,
  trashOutline,
} from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '@app/auth/auth.service';
import { DepartmentsService } from '@app/data/departments.service';
import { StaffService } from '@app/data/staff.service';
import { Staff, StaffRole } from '@app/data/types';

const ALL = '__all__';

@Component({
  selector: 'app-staff-detail-modal',
  templateUrl: 'staff-detail.modal.html',
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
    IonIcon,
    IonBadge,
    IonText,
    IonSelect,
    IonSelectOption,
    TranslatePipe,
  ],
})
export class StaffDetailModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly t = inject(TranslateService);
  private readonly auth = inject(AuthService);
  readonly staff = inject(StaffService);
  readonly departments = inject(DepartmentsService);

  @Input({ required: true }) staffId!: string;

  readonly record = computed<Staff | null>(
    () => this.staff.all().find((s) => s.id === this.staffId) ?? null,
  );

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    role: ['employee' as StaffRole, [Validators.required]],
    allDepartments: [false],
    departmentIds: [[] as string[]],
  });

  readonly isEmployee = computed(() => this.form.controls.role.value === 'employee');

  protected readonly ALL = ALL;

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
      this.form.patchValue({
        allDepartments: false,
        departmentIds: next.filter((v) => v !== ALL),
      });
    } else if (!wasAll && hasAll) {
      this.form.patchValue({ allDepartments: true, departmentIds: [] });
    } else {
      this.form.patchValue({
        allDepartments: false,
        departmentIds: next.filter((v) => v !== ALL),
      });
    }
    this.form.markAsDirty();
  }

  readonly saving = signal(false);
  readonly sendingInvite = signal(false);

  protected readonly callOutline = callOutline;
  protected readonly mailOutline = mailOutline;
  protected readonly paperPlaneOutline = paperPlaneOutline;
  protected readonly trashOutline = trashOutline;

  constructor() {
    addIcons({ 'close-outline': closeOutline });
    effect(() => {
      const r = this.record();
      if (r && this.form.pristine) {
        this.form.patchValue(
          {
            firstName: r.firstName,
            lastName: r.lastName,
            email: r.email,
            phone: r.phone ?? '',
            role: r.role,
            allDepartments: r.allDepartments,
            departmentIds: [...r.departmentIds],
          },
          { emitEvent: false },
        );
      }
    });
  }

  ngOnInit(): void {
    const r = this.record();
    if (r) {
      this.form.patchValue({
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        phone: r.phone ?? '',
        role: r.role,
        allDepartments: r.allDepartments,
        departmentIds: [...r.departmentIds],
      });
      this.form.markAsPristine();
    }
  }

  initials(s: Staff | null): string {
    if (!s) return '?';
    return (
      [s.firstName?.[0], s.lastName?.[0]]
        .filter(Boolean)
        .join('')
        .toUpperCase() || '?'
    );
  }

  departmentName(id: string): string {
    return this.departments.all().find((d) => d.id === id)?.name ?? '';
  }

  close(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  async save(): Promise<void> {
    const r = this.record();
    if (!r || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const raw = this.form.getRawValue();
      await this.staff.update(r.id, {
        firstName: raw.firstName,
        lastName: raw.lastName,
        email: raw.email,
        phone: raw.phone,
        role: raw.role,
        departmentIds: raw.role === 'admin' ? [] : raw.departmentIds,
        allDepartments: raw.role === 'admin' ? true : raw.allDepartments,
      });
      this.form.markAsPristine();
    } finally {
      this.saving.set(false);
    }
  }

  async confirmDelete(): Promise<void> {
    const r = this.record();
    if (!r) return;
    const alert = await this.alertCtrl.create({
      header: this.t.instant('common.confirmDeleteTitle'),
      message: this.t.instant('common.confirmDeleteMessage', {
        name: `${r.firstName} ${r.lastName}`,
      }),
      buttons: [
        { text: this.t.instant('common.cancel'), role: 'cancel' },
        {
          text: this.t.instant('common.delete'),
          role: 'destructive',
          handler: async () => {
            await this.staff.remove(r.id);
            await this.modalCtrl.dismiss({ deleted: true }, 'confirm');
          },
        },
      ],
    });
    await alert.present();
  }

  async sendInvite(): Promise<void> {
    const r = this.record();
    if (!r || this.sendingInvite()) return;
    this.sendingInvite.set(true);
    try {
      await this.auth.sendInviteEmail(r.email);
      await this.showToast('admin.staff.detail.inviteSent', 'success', { email: r.email });
    } catch (err) {
      const toast = await this.toastCtrl.create({
        message: (err as Error)?.message ?? this.t.instant('auth.errors.generic'),
        duration: 3500,
        color: 'danger',
        position: 'bottom',
      });
      await toast.present();
    } finally {
      this.sendingInvite.set(false);
    }
  }

  private async showToast(
    key: string,
    color: 'success' | 'danger' | 'medium',
    params?: Record<string, unknown>,
  ): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: this.t.instant(key, params),
      duration: 2500,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}

import { Component, Input, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AlertController,
  IonAvatar,
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
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { AssignChildrenModal, AssignChildrenResult } from '../assign-children/assign-children.modal';
import { addIcons } from 'ionicons';
import {
  callOutline,
  closeCircleOutline,
  closeOutline,
  mailOutline,
  paperPlaneOutline,
  personAddOutline,
  trashOutline,
} from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '@app/auth/auth.service';
import { DateDmyPipe } from '@app/shared/pipes/date-dmy.pipe';
import { ChildrenService } from '@app/data/children.service';
import { ParentsService } from '@app/data/parents.service';
import { Child, Parent } from '@app/data/types';

@Component({
  selector: 'app-parent-detail-modal',
  templateUrl: 'parent-detail.modal.html',
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
    IonText,
    TranslatePipe,
    DateDmyPipe,
  ],
})
export class ParentDetailModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly t = inject(TranslateService);
  private readonly auth = inject(AuthService);
  readonly parents = inject(ParentsService);
  readonly children = inject(ChildrenService);

  @Input({ required: true }) parentId!: string;

  // Live parent record derived from the parents list; refreshes when child
  // assignments change (the page below us writes to Firestore).
  readonly parent = computed<Parent | null>(
    () => this.parents.all().find((p) => p.id === this.parentId) ?? null,
  );

  readonly childById = computed(() => {
    const map = new Map<string, Child>();
    for (const c of this.children.all()) map.set(c.id, c);
    return map;
  });

  readonly assignedChildren = computed<Child[]>(() => {
    const p = this.parent();
    if (!p) return [];
    return p.childIds
      .map((id) => this.childById().get(id))
      .filter((c): c is Child => !!c);
  });

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
  });

  readonly saving = signal(false);
  readonly sendingInvite = signal(false);

  protected readonly callOutline = callOutline;
  protected readonly closeCircleOutline = closeCircleOutline;
  protected readonly mailOutline = mailOutline;
  protected readonly paperPlaneOutline = paperPlaneOutline;
  protected readonly personAddOutline = personAddOutline;
  protected readonly trashOutline = trashOutline;

  constructor() {
    addIcons({ 'close-outline': closeOutline });
    // Keep form in sync with live parent record (only when pristine, so user
    // edits aren't clobbered).
    effect(() => {
      const p = this.parent();
      if (p && this.form.pristine) {
        this.form.patchValue(
          {
            firstName: p.firstName,
            lastName: p.lastName,
            email: p.email,
            phone: p.phone ?? '',
          },
          { emitEvent: false },
        );
      }
    });
  }

  ngOnInit(): void {
    const p = this.parent();
    if (p) {
      this.form.patchValue({
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone ?? '',
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

  close(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  async save(): Promise<void> {
    const p = this.parent();
    if (!p || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      await this.parents.update(p.id, this.form.getRawValue());
      this.form.markAsPristine();
    } finally {
      this.saving.set(false);
    }
  }

  async confirmDelete(): Promise<void> {
    const p = this.parent();
    if (!p) return;
    const alert = await this.alertCtrl.create({
      header: this.t.instant('common.confirmDeleteTitle'),
      message: this.t.instant('common.confirmDeleteMessage', {
        name: `${p.firstName} ${p.lastName}`,
      }),
      buttons: [
        { text: this.t.instant('common.cancel'), role: 'cancel' },
        {
          text: this.t.instant('common.delete'),
          role: 'destructive',
          handler: async () => {
            await this.parents.remove(p.id);
            await this.modalCtrl.dismiss({ deleted: true }, 'confirm');
          },
        },
      ],
    });
    await alert.present();
  }

  async openAssign(): Promise<void> {
    const p = this.parent();
    if (!p) return;
    const available = this.children.all().filter((c) => !p.childIds.includes(c.id));
    if (available.length === 0) {
      await this.showToast('admin.parents.noAvailableChildren', 'medium');
      return;
    }
    const modal = await this.modalCtrl.create({
      component: AssignChildrenModal,
      componentProps: { available },
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<AssignChildrenResult>();
    if (role !== 'confirm' || !data?.selectedIds?.length) return;
    for (const id of data.selectedIds) {
      await this.parents.assignChild(p.id, id);
    }
  }

  async unassign(childId: string): Promise<void> {
    const p = this.parent();
    if (!p) return;
    await this.parents.unassignChild(p.id, childId);
  }

  async sendInvite(): Promise<void> {
    const p = this.parent();
    if (!p || this.sendingInvite()) return;
    this.sendingInvite.set(true);
    try {
      await this.auth.sendInviteEmail(p.email);
      await this.showToast(
        'admin.parents.detail.inviteSent',
        'success',
        { email: p.email },
      );
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

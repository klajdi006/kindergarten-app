import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonNote,
  IonRow,
  IonSpinner,
  IonText,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '@app/auth/auth.service';
import { ParentsService } from '@app/data/parents.service';
import { StaffService } from '@app/data/staff.service';
import { Staff } from '@app/data/types';
import { ThemeToggleComponent } from '@app/shared/components/theme-toggle/theme-toggle.component';
import { LanguageToggleComponent } from '@app/shared/components/language-toggle/language-toggle.component';

type Mode = 'link' | 'manual';

@Component({
  selector: 'app-claim',
  templateUrl: 'claim.page.html',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonList,
    IonItem,
    IonInput,
    IonNote,
    IonButton,
    IonSpinner,
    IonText,
    TranslatePipe,
    ThemeToggleComponent,
    LanguageToggleComponent,
  ],
})
export class ClaimPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly parents = inject(ParentsService);
  private readonly staff = inject(StaffService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isLoading = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly mode = signal<Mode>('manual');
  readonly inviteEmail = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly emailLocked = computed(() => this.mode() === 'link');

  constructor() {
    const currentUrl = window.location.href;
    const isLink = this.auth.isEmailLinkUrl(currentUrl);
    const emailFromQuery = this.route.snapshot.queryParamMap.get('email');

    if (isLink && emailFromQuery) {
      this.mode.set('link');
      this.inviteEmail.set(emailFromQuery);
      this.form.patchValue({ email: emailFromQuery });
      this.form.controls.email.disable();
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isLoading.set(true);
    this.errorKey.set(null);
    const { password } = this.form.getRawValue();
    const email = (this.inviteEmail() ?? this.form.controls.email.value).trim().toLowerCase();

    try {
      const target =
        this.mode() === 'link'
          ? await this.completeViaLink(email, password)
          : await this.completeViaManual(email, password);
      await this.router.navigateByUrl(target);
    } catch (err) {
      console.error('[claim] submit failed:', err);
      if (!this.errorKey()) {
        this.errorKey.set(this.auth.errorMessage() ?? 'auth.errors.generic');
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  private async completeViaLink(email: string, password: string): Promise<string> {
    const uid = await this.auth.signInWithLink(email, window.location.href);

    const staffRecord = await this.staff.findUnclaimedByEmail(email);
    if (staffRecord) {
      return this.finalizeStaffClaim(staffRecord, password, uid);
    }
    const parentRecord = await this.parents.findUnclaimedByEmail(email);
    const displayName = parentRecord
      ? `${parentRecord.firstName} ${parentRecord.lastName}`.trim()
      : email.split('@')[0];
    await this.auth.finalizeParentProfile(
      password,
      displayName,
      parentRecord?.kindergartenId ?? '',
    );
    if (parentRecord) {
      await this.parents.markClaimed(parentRecord.id, uid);
    }
    return '/parent';
  }

  private async completeViaManual(email: string, password: string): Promise<string> {
    const staffRecord = await this.staff.findUnclaimedByEmail(email);
    if (staffRecord) {
      const displayName = `${staffRecord.firstName} ${staffRecord.lastName}`.trim();
      const uid = await this.auth.createStaffAccount(
        email,
        password,
        displayName,
        staffRecord.role,
        staffRecord.kindergartenId,
        staffRecord.id,
      );
      await this.staff.markClaimed(staffRecord.id, uid);
      return staffRecord.role === 'admin' ? '/admin' : '/employee';
    }

    const parentRecord = await this.parents.findUnclaimedByEmail(email);
    if (!parentRecord) {
      this.errorKey.set('claim.errors.noInvite');
      throw new Error('No invite');
    }
    const displayName = `${parentRecord.firstName} ${parentRecord.lastName}`.trim();
    const uid = await this.auth.createParentAccount(
      email,
      password,
      displayName,
      parentRecord.kindergartenId,
    );
    await this.parents.markClaimed(parentRecord.id, uid);
    return '/parent';
  }

  private async finalizeStaffClaim(
    staff: Staff,
    password: string,
    uid: string,
  ): Promise<string> {
    const displayName = `${staff.firstName} ${staff.lastName}`.trim();
    await this.auth.finalizeStaffProfile(
      password,
      displayName,
      staff.role,
      staff.kindergartenId,
      staff.id,
    );
    await this.staff.markClaimed(staff.id, uid);
    return staff.role === 'admin' ? '/admin' : '/employee';
  }
}

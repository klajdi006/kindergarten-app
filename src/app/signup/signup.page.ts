import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
  IonTextarea,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '@app/auth/auth.service';
import { ThemeToggleComponent } from '@app/shared/components/theme-toggle/theme-toggle.component';
import { LanguageToggleComponent } from '@app/shared/components/language-toggle/language-toggle.component';

@Component({
  selector: 'app-signup',
  templateUrl: 'signup.page.html',
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
    IonTextarea,
    IonNote,
    IonButton,
    IonSpinner,
    IonText,
    TranslatePipe,
    ThemeToggleComponent,
    LanguageToggleComponent,
  ],
})
export class SignupPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly isLoading = this.auth.isLoading;
  readonly errorMessage = this.auth.errorMessage;

  /** Set once the confirmation email has been queued. */
  readonly sentToEmail = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    displayName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    kindergartenName: ['', [Validators.required]],
    address: ['', [Validators.required]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, displayName, kindergartenName, address } = this.form.getRawValue();
    try {
      await this.auth.requestAdminSignup({
        email: email.trim(),
        displayName: displayName.trim(),
        kindergartenName: kindergartenName.trim(),
        address: address.trim(),
      });
      this.sentToEmail.set(email.trim());
      this.form.reset();
    } catch {
      // error already surfaced via auth.errorMessage signal
    }
  }
}

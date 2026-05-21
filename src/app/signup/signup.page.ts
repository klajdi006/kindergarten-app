import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
  private readonly router = inject(Router);

  readonly isLoading = this.auth.isLoading;
  readonly errorMessage = this.auth.errorMessage;

  readonly form = this.fb.nonNullable.group({
    displayName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    kindergartenName: ['', [Validators.required]],
    address: ['', [Validators.required]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password, displayName, kindergartenName, address } = this.form.getRawValue();
    try {
      await this.auth.signUpAdmin(
        email.trim(),
        password,
        displayName.trim(),
        kindergartenName.trim(),
        address.trim(),
      );
      this.form.reset();
      await this.router.navigateByUrl('/admin');
    } catch {
      // error already surfaced via auth.errorMessage signal
    }
  }
}

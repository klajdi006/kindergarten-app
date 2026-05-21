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
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '@app/auth/auth.service';
import { ThemeToggleComponent } from '@app/shared/components/theme-toggle/theme-toggle.component';
import { LanguageToggleComponent } from '@app/shared/components/language-toggle/language-toggle.component';

@Component({
  selector: 'app-login',
  templateUrl: 'login.page.html',
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
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly isLoading = this.auth.isLoading;
  readonly errorMessage = this.auth.errorMessage;

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    try {
      await this.auth.signIn(email.trim(), password);
      this.form.reset();
      await this.router.navigateByUrl('/');
    } catch {
      // error is already surfaced via auth.errorMessage signal
    }
  }
}

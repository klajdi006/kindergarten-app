import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
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
  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import {
  businessOutline,
  colorPaletteOutline,
  languageOutline,
  locationOutline,
  logOutOutline,
  mailOutline,
  personOutline,
  timeOutline,
} from 'ionicons/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '@app/auth/auth.service';
import { KindergartensService } from '@app/data/kindergartens.service';
import { getOperatingHours, WEEK_DAYS } from '@app/data/schedule';
import { OperatingHoursModal } from '@app/settings/operating-hours/operating-hours.modal';
import { LanguageService } from '@app/shared/services/language.service';
import { ThemeService } from '@app/shared/services/theme.service';

@Component({
  selector: 'app-settings',
  templateUrl: 'settings.page.html',
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonIcon,
    IonText,
    TranslatePipe,
  ],
})
export class SettingsPage {
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);
  readonly kindergartens = inject(KindergartensService);
  readonly lang = inject(LanguageService);
  readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly modalCtrl = inject(ModalController);

  readonly profile = toSignal(this.auth.userDoc$, { initialValue: null });
  readonly isLoading = this.auth.isLoading;
  readonly errorMessage = this.auth.errorMessage;

  readonly initials = computed(() => {
    const name = this.auth.currentUser()?.displayName || this.auth.currentUser()?.email || '?';
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('') || '?'
    );
  });

  readonly form = this.fb.nonNullable.group({
    displayName: ['', [Validators.required]],
  });

  readonly kgForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    address: [''],
  });

  protected readonly logOutOutline = logOutOutline;
  protected readonly personOutline = personOutline;
  protected readonly businessOutline = businessOutline;
  protected readonly locationOutline = locationOutline;
  protected readonly mailOutline = mailOutline;
  protected readonly languageOutline = languageOutline;
  protected readonly colorPaletteOutline = colorPaletteOutline;
  protected readonly timeOutline = timeOutline;

  readonly openDaysCount = computed(
    () =>
      WEEK_DAYS.filter((d) => getOperatingHours(this.kindergartens.current())[d].open).length,
  );

  constructor() {
    effect(() => {
      const doc = this.profile();
      if (doc && this.form.pristine) {
        this.form.patchValue({ displayName: doc.displayName ?? '' }, { emitEvent: false });
      }
    });
    effect(() => {
      const kg = this.kindergartens.current();
      if (kg && this.kgForm.pristine) {
        this.kgForm.patchValue(
          { name: kg.name ?? '', address: kg.address ?? '' },
          { emitEvent: false },
        );
      }
    });
  }

  async openOperatingHours(): Promise<void> {
    const operatingHours = getOperatingHours(this.kindergartens.current());
    const modal = await this.modalCtrl.create({
      component: OperatingHoursModal,
      componentProps: { operatingHours },
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data) {
      await this.kindergartens.updateOperatingHours(data);
    }
  }

  async saveProfile(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { displayName } = this.form.getRawValue();
    try {
      await this.auth.updateUserProfile({ displayName: displayName.trim() });
      this.form.markAsPristine();
    } catch {
      // surfaced via errorMessage signal
    }
  }

  async saveKindergarten(): Promise<void> {
    if (this.kgForm.invalid) {
      this.kgForm.markAllAsTouched();
      return;
    }
    const { name, address } = this.kgForm.getRawValue();
    await this.kindergartens.update({ name: name.trim(), address: address.trim() || null });
    this.kgForm.markAsPristine();
  }

  onLanguageChange(event: CustomEvent): void {
    const value = event.detail.value;
    if (value === 'en' || value === 'al') this.lang.use(value);
  }

  onThemeChange(event: CustomEvent): void {
    const value = event.detail.value;
    if (value === 'system' || value === 'light' || value === 'dark') {
      this.theme.setPreference(value);
    }
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}

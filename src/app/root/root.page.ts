import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonSpinner, IonText } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { combineLatest } from 'rxjs';
import { AuthService } from '@app/auth/auth.service';

@Component({
  selector: 'app-root-splash',
  templateUrl: 'root.page.html',
  imports: [IonContent, IonSpinner, IonButton, IonText, TranslatePipe],
})
export class RootPage {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly stuck = signal(false);
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    combineLatest([this.auth.firebaseUser$, this.auth.userDoc$])
      .pipe(takeUntilDestroyed())
      .subscribe(([user, profile]) => {
        if (!user) {
          this.cancelStuckTimer();
          this.router.navigateByUrl('/login');
          return;
        }
        const role = profile?.role ?? null;
        if (role === 'admin') {
          this.cancelStuckTimer();
          this.router.navigateByUrl('/admin');
          return;
        }
        if (role === 'parent') {
          this.cancelStuckTimer();
          this.router.navigateByUrl('/parent');
          return;
        }
        if (role === 'employee') {
          this.cancelStuckTimer();
          this.router.navigateByUrl('/employee');
          return;
        }
        if (this.timeoutId === null && !this.stuck()) {
          this.timeoutId = setTimeout(() => {
            this.stuck.set(true);
            this.timeoutId = null;
          }, 5000);
        }
      });
  }

  async signOut(): Promise<void> {
    this.cancelStuckTimer();
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }

  private cancelStuckTimer(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.stuck.set(false);
  }
}

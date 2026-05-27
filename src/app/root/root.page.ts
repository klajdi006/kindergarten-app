import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonSpinner, IonText } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { combineLatest } from 'rxjs';
import { AuthService } from '@app/auth/auth.service';
import { NotificationRouterService } from '@app/data/notification-router.service';

@Component({
  selector: 'app-root-splash',
  templateUrl: 'root.page.html',
  styleUrl: './root.page.scss',
  imports: [IonContent, IonSpinner, IonButton, IonText, TranslatePipe],
})
export class RootPage {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifRouter = inject(NotificationRouterService);

  readonly stuck = signal(false);
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  /**
   * Latched once we yield routing control to the notification router. Auth
   * observables can emit multiple times during boot; without this flag a
   * later emission (after hasPending is consumed) would still redirect to
   * the role landing page and clobber the notif destination.
   */
  private notifTakingOver = false;

  constructor() {
    combineLatest([this.auth.firebaseUser$, this.auth.userDoc$])
      .pipe(takeUntilDestroyed())
      .subscribe(([user, profile]) => {
        if (this.notifTakingOver) return;
        if (!user) {
          this.cancelStuckTimer();
          this.router.navigateByUrl('/login');
          return;
        }
        const role = profile?.role ?? null;
        // If a notification tap is queued, let NotificationRouterService own
        // the destination instead of redirecting to the role landing page.
        if (role && this.notifRouter.hasPending()) {
          this.cancelStuckTimer();
          this.notifTakingOver = true;
          return;
        }
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
    // auth.signOut() hard-reloads into /login.
    await this.auth.signOut();
  }

  private cancelStuckTimer(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.stuck.set(false);
  }
}

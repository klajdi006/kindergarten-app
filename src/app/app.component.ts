import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import '@khmyznikov/pwa-install';
import { AuthService } from '@app/auth/auth.service';
import { NotificationRouterService } from '@app/data/notification-router.service';
import { PushService } from '@app/data/push.service';
import { ThemeService } from '@app/shared/services/theme.service';
import { LanguageService } from '@app/shared/services/language.service';
import { PwaUpdateService } from '@app/shared/services/pwa-update.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppComponent {
  private readonly auth = inject(AuthService);
  private readonly push = inject(PushService);
  private readonly notifRouter = inject(NotificationRouterService);

  constructor() {
    inject(ThemeService);
    inject(LanguageService);
    inject(PwaUpdateService);

    let refreshedFor: string | null = null;
    effect(() => {
      const u = this.auth.currentUser();
      if (u && refreshedFor !== u.uid) {
        refreshedFor = u.uid;
        void this.push.enable();
      }
    });

    // Dispatch any queued notification payload once role is known. RootPage
    // checks notifRouter.hasPending() and skips its own redirect so this nav
    // is the one that lands.
    effect(() => {
      if (this.notifRouter.hasPending() && this.auth.role()) {
        const payload = this.notifRouter.consume();
        if (payload) void this.notifRouter.handle(payload);
      }
    });

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.source === 'fcm-click') {
          this.notifRouter.queue(event.data.payload);
        }
      });
    }

    // Cold-start: the SW opened a new window with ?notif=<encoded payload>.
    if (typeof window !== 'undefined' && window.location.search.includes('notif=')) {
      try {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get('notif');
        if (raw) this.notifRouter.queue(JSON.parse(decodeURIComponent(raw)));
      } catch (err) {
        console.warn('[notif] could not parse cold-start payload', err);
      }
    }
  }
}

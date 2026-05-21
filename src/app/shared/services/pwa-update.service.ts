import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { AlertController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { filter, firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private readonly sw = inject(SwUpdate);
  private readonly alertCtrl = inject(AlertController);
  private readonly translate = inject(TranslateService);

  private prompting = false;

  constructor() {
    if (!this.sw.isEnabled) return;

    this.sw.versionUpdates
      .pipe(
        filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.promptForReload());
  }

  private async promptForReload(): Promise<void> {
    if (this.prompting) return;
    this.prompting = true;
    try {
      const [title, message, confirm, cancel] = await Promise.all([
        firstValueFrom(this.translate.get('pwa.update.title')),
        firstValueFrom(this.translate.get('pwa.update.message')),
        firstValueFrom(this.translate.get('pwa.update.confirm')),
        firstValueFrom(this.translate.get('pwa.update.cancel')),
      ]);

      const alert = await this.alertCtrl.create({
        header: title,
        message,
        backdropDismiss: false,
        buttons: [
          { text: cancel, role: 'cancel' },
          {
            text: confirm,
            role: 'confirm',
            handler: () => {
              this.sw.activateUpdate().then(() => document.location.reload());
            },
          },
        ],
      });
      await alert.present();
      await alert.onDidDismiss();
    } finally {
      this.prompting = false;
    }
  }
}

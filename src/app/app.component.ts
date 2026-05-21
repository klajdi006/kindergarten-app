import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { ThemeService } from '@app/shared/services/theme.service';
import { LanguageService } from '@app/shared/services/language.service';
import { PwaUpdateService } from '@app/shared/services/pwa-update.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  constructor() {
    inject(ThemeService);
    inject(LanguageService);
    inject(PwaUpdateService);
  }
}

import { Component, inject } from '@angular/core';
import { IonButton } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '@app/shared/services/language.service';

@Component({
  selector: 'app-language-toggle',
  templateUrl: './language-toggle.component.html',
  imports: [IonButton, TranslatePipe],
})
export class LanguageToggleComponent {
  readonly lang = inject(LanguageService);
}

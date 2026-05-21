import { Component, computed, inject } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { contrastOutline, moonOutline, sunnyOutline } from 'ionicons/icons';
import { ThemeService } from '@app/shared/services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.component.html',
  imports: [IonButton, IonIcon],
})
export class ThemeToggleComponent {
  readonly theme = inject(ThemeService);

  readonly icon = computed(() => {
    switch (this.theme.preference()) {
      case 'light':
        return 'sunny-outline';
      case 'dark':
        return 'moon-outline';
      default:
        return 'contrast-outline';
    }
  });

  readonly ariaLabel = computed(() => `Theme: ${this.theme.preference()} (tap to change)`);

  constructor() {
    addIcons({
      'contrast-outline': contrastOutline,
      'moon-outline': moonOutline,
      'sunny-outline': sunnyOutline,
    });
  }
}

import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  chatbubblesOutline,
  documentsOutline,
  homeOutline,
  peopleOutline,
  settingsOutline,
} from 'ionicons/icons';
import { filter, map } from 'rxjs';
import { isConversationDetailUrl } from '@app/shared/utils/conversation-route';

@Component({
  selector: 'app-admin',
  templateUrl: 'admin.page.html',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, TranslatePipe],
})
export class AdminPage {
  private readonly router = inject(Router);

  readonly inConversation = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => isConversationDetailUrl(e.urlAfterRedirects)),
    ),
    { initialValue: isConversationDetailUrl(this.router.url) },
  );

  constructor() {
    addIcons({
      'home-outline': homeOutline,
      'people-outline': peopleOutline,
      'documents-outline': documentsOutline,
      'chatbubbles-outline': chatbubblesOutline,
      'settings-outline': settingsOutline,
    });
  }
}

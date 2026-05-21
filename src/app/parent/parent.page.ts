import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  chatbubblesOutline,
  newspaperOutline,
  peopleOutline,
  settingsOutline,
} from 'ionicons/icons';
import { filter, map } from 'rxjs';
import { isConversationDetailUrl } from '@app/shared/utils/conversation-route';

@Component({
  selector: 'app-parent',
  templateUrl: 'parent.page.html',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, TranslatePipe],
})
export class ParentPage {
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
      'newspaper-outline': newspaperOutline,
      'people-outline': peopleOutline,
      'chatbubbles-outline': chatbubblesOutline,
      'settings-outline': settingsOutline,
    });
  }
}

import { Component, input } from '@angular/core';
import { IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-tab-header',
  templateUrl: './tab-header.component.html',
  imports: [IonHeader, IonToolbar, IonTitle, TranslatePipe],
})
export class TabHeaderComponent {
  readonly title = input.required<string>();
}

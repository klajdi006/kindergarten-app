import { Component, computed, input } from '@angular/core';
import { IonAvatar, IonItem, IonLabel, IonList, IonSkeletonText } from '@ionic/angular/standalone';

@Component({
  selector: 'app-skeleton-list',
  templateUrl: 'skeleton-list.component.html',
  imports: [IonList, IonItem, IonAvatar, IonLabel, IonSkeletonText],
})
export class SkeletonListComponent {
  readonly count = input<number>(5);
  readonly avatar = input<boolean>(true);
  readonly lines = input<number>(2);

  readonly rows = computed(() => Array.from({ length: this.count() }, (_, i) => i));
  readonly lineRows = computed(() => Array.from({ length: this.lines() }, (_, i) => i));
}

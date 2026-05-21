import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import {
  IonHeader,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { filter } from 'rxjs';

type PeopleSegment = 'parents' | 'children' | 'departments' | 'staff';

@Component({
  selector: 'app-admin-people',
  templateUrl: 'admin-people.page.html',
  imports: [
    RouterOutlet,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    TranslatePipe,
  ],
})
export class AdminPeoplePage {
  private readonly router = inject(Router);
  readonly segment = signal<PeopleSegment>('parents');

  constructor() {
    this.segment.set(this.deriveSegment(this.router.url));
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => this.segment.set(this.deriveSegment(e.urlAfterRedirects)));
  }

  onSegmentChange(event: CustomEvent): void {
    const value = event.detail.value as PeopleSegment;
    if (
      value === 'parents' ||
      value === 'children' ||
      value === 'departments' ||
      value === 'staff'
    ) {
      this.router.navigate(['/admin/people', value]);
    }
  }

  private deriveSegment(url: string): PeopleSegment {
    if (url.includes('/people/children')) return 'children';
    if (url.includes('/people/departments')) return 'departments';
    if (url.includes('/people/staff')) return 'staff';
    return 'parents';
  }
}

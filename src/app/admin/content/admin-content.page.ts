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

type ContentSegment = 'posts' | 'albums';

@Component({
  selector: 'app-admin-content',
  templateUrl: 'admin-content.page.html',
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
export class AdminContentPage {
  private readonly router = inject(Router);
  readonly segment = signal<ContentSegment>('posts');

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
    const value = event.detail.value as ContentSegment;
    if (value === 'posts' || value === 'albums') {
      this.router.navigate(['/admin/content', value]);
    }
  }

  private deriveSegment(url: string): ContentSegment {
    if (url.includes('/content/albums')) return 'albums';
    return 'posts';
  }
}

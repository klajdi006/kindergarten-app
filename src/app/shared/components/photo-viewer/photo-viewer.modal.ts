import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { Photo } from '@app/data/types';

@Component({
  selector: 'app-photo-viewer-modal',
  templateUrl: 'photo-viewer.modal.html',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonIcon,
  ],
})
export class PhotoViewerModal implements AfterViewInit {
  private readonly modalCtrl = inject(ModalController);

  @Input({ required: true }) photos!: Photo[];
  @Input() startIndex = 0;

  @ViewChild('track', { static: false }) trackEl?: ElementRef<HTMLDivElement>;

  readonly currentIndex = signal(0);

  constructor() {
    addIcons({ 'close-outline': closeOutline });
  }

  /** True until we've performed the initial jump to startIndex, so the
   *  onScroll handler doesn't fight the programmatic scroll. */
  private settled = false;

  ngAfterViewInit(): void {
    this.currentIndex.set(
      Math.min(Math.max(this.startIndex, 0), this.photos.length - 1),
    );
    this.scrollToStartWhenReady(0);
  }

  /**
   * The modal animates in, so the track's clientWidth is 0 for a few frames.
   * Retry on each animation frame until it has a real width, then jump.
   */
  private scrollToStartWhenReady(attempt: number): void {
    const el = this.trackEl?.nativeElement;
    if (el && el.clientWidth > 0) {
      el.scrollTo({ left: this.currentIndex() * el.clientWidth, behavior: 'auto' });
      // Let the resulting scroll event settle before trusting onScroll.
      requestAnimationFrame(() => (this.settled = true));
      return;
    }
    if (attempt > 60) {
      this.settled = true;
      return;
    }
    requestAnimationFrame(() => this.scrollToStartWhenReady(attempt + 1));
  }

  close(): void {
    this.modalCtrl.dismiss();
  }

  onScroll(): void {
    if (!this.settled) return;
    const el = this.trackEl?.nativeElement;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== this.currentIndex()) this.currentIndex.set(idx);
  }
}

import {
  CUSTOM_ELEMENTS_SCHEMA,
  Component,
  Input,
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
import { register } from 'swiper/element/bundle';

export interface ViewablePhoto {
  id: string;
  downloadUrl: string;
}

// Registers the <swiper-container> / <swiper-slide> custom elements. Idempotent.
register();

@Component({
  selector: 'app-photo-viewer-modal',
  templateUrl: 'photo-viewer.modal.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
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
export class PhotoViewerModal {
  private readonly modalCtrl = inject(ModalController);

  @Input({ required: true }) photos!: ViewablePhoto[];
  @Input() startIndex = 0;

  readonly currentIndex = signal(0);

  constructor() {
    addIcons({ 'close-outline': closeOutline });
  }

  /**
   * Jump to the tapped photo once Swiper is initialized. Setting it here
   * (rather than via the `initial-slide` attribute) avoids the attribute
   * being read before Angular has rendered the slides.
   */
  onInit(event: Event): void {
    const swiper = (event as CustomEvent).detail?.[0];
    if (!swiper) return;
    const idx = Math.min(Math.max(this.startIndex, 0), this.photos.length - 1);
    swiper.slideTo(idx, 0, false);
    this.currentIndex.set(idx);
  }

  /** Swiper fires this with detail = [swiperInstance]. */
  onSlideChange(event: Event): void {
    const swiper = (event as CustomEvent).detail?.[0];
    if (swiper && typeof swiper.activeIndex === 'number') {
      this.currentIndex.set(swiper.activeIndex);
    }
  }

  close(): void {
    this.modalCtrl.dismiss();
  }
}

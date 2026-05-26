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

  ngAfterViewInit(): void {
    this.currentIndex.set(Math.min(this.startIndex, this.photos.length - 1));
    queueMicrotask(() => this.scrollTo(this.currentIndex(), 'instant'));
  }

  close(): void {
    this.modalCtrl.dismiss();
  }

  onScroll(): void {
    const el = this.trackEl?.nativeElement;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== this.currentIndex()) this.currentIndex.set(idx);
  }

  private scrollTo(index: number, behavior: ScrollBehavior): void {
    const el = this.trackEl?.nativeElement;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior });
  }
}

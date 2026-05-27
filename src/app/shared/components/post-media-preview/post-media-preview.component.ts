import { CUSTOM_ELEMENTS_SCHEMA, Component, computed, inject, input } from '@angular/core';
import { IonIcon, ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { attachOutline } from 'ionicons/icons';
import { register } from 'swiper/element/bundle';
import { Photo, Post, PostAttachment } from '@app/data/types';
import { PhotoViewerModal } from '@app/shared/components/photo-viewer/photo-viewer.modal';

// Registers <swiper-container> / <swiper-slide>. Idempotent.
register();

/** Which part of a post's media to render. */
type Section = 'images' | 'files' | 'all';

@Component({
  selector: 'app-post-media-preview',
  templateUrl: 'post-media-preview.component.html',
  styleUrl: 'post-media-preview.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [IonIcon],
})
export class PostMediaPreviewComponent {
  private readonly modalCtrl = inject(ModalController);

  readonly post = input.required<Post>();
  /**
   * Render only the image carousel (`images`), only the file links (`files`),
   * or both (`all`). Feed cards pass `images` above the description and `files`
   * below it.
   */
  readonly section = input<Section>('all');

  readonly images = computed(() => this.post().imageUrls ?? []);
  readonly attachments = computed<PostAttachment[]>(() => this.post().attachments ?? []);

  readonly showImages = computed(() => this.section() !== 'files' && this.images().length > 0);
  readonly showFiles = computed(() => this.section() !== 'images' && this.attachments().length > 0);

  constructor() {
    addIcons({ 'attach-outline': attachOutline });
  }

  async openImage(index: number, event: Event): Promise<void> {
    event.stopPropagation();
    const photos: Photo[] = this.images().map((url, i) => ({
      id: `${i}`,
      downloadUrl: url,
    })) as Photo[];
    const modal = await this.modalCtrl.create({
      component: PhotoViewerModal,
      componentProps: { photos, startIndex: index },
    });
    await modal.present();
  }
}

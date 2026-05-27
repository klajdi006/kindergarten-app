import { Component, computed, inject, input } from '@angular/core';
import { IonIcon, ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { attachOutline } from 'ionicons/icons';
import { Photo, Post, PostAttachment } from '@app/data/types';
import { PhotoViewerModal } from '@app/shared/components/photo-viewer/photo-viewer.modal';

const MAX_THUMBS = 3;

@Component({
  selector: 'app-post-media-preview',
  templateUrl: 'post-media-preview.component.html',
  styleUrl: 'post-media-preview.component.scss',
  imports: [IonIcon],
})
export class PostMediaPreviewComponent {
  private readonly modalCtrl = inject(ModalController);

  readonly post = input.required<Post>();

  readonly images = computed(() => this.post().imageUrls ?? []);
  readonly thumbs = computed(() => this.images().slice(0, MAX_THUMBS));
  readonly extra = computed(() => Math.max(0, this.images().length - MAX_THUMBS));
  readonly attachments = computed<PostAttachment[]>(() => this.post().attachments ?? []);

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

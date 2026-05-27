import { Component, Input, inject } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  documentOutline,
  downloadOutline,
  globeOutline,
  personCircleOutline,
  timeOutline,
} from 'ionicons/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { DateDmyPipe } from '@app/shared/pipes/date-dmy.pipe';
import { Photo, Post } from '@app/data/types';
import { PhotoViewerModal } from '@app/shared/components/photo-viewer/photo-viewer.modal';

@Component({
  selector: 'app-post-view-modal',
  templateUrl: 'post-view.modal.html',
  styleUrl: './post-view.modal.scss',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonIcon,
    IonLabel,
    IonText,
    IonChip,
    TranslatePipe,
    DateDmyPipe,
  ],
})
export class PostViewModal {
  private readonly modalCtrl = inject(ModalController);

  @Input({ required: true }) post!: Post;
  @Input() departmentName: string | null = null;

  constructor() {
    addIcons({
      'close-outline': closeOutline,
      'globe-outline': globeOutline,
      'person-circle-outline': personCircleOutline,
      'time-outline': timeOutline,
      'document-outline': documentOutline,
      'download-outline': downloadOutline,
    });
  }

  async openImage(index: number): Promise<void> {
    const photos: Photo[] = this.post.imageUrls.map((url, i) => ({
      id: `${i}`,
      downloadUrl: url,
    })) as Photo[];
    const modal = await this.modalCtrl.create({
      component: PhotoViewerModal,
      componentProps: { photos, startIndex: index },
    });
    await modal.present();
  }

  close(): void {
    this.modalCtrl.dismiss();
  }
}

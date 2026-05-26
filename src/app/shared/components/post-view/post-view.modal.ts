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
  globeOutline,
  personCircleOutline,
  timeOutline,
} from 'ionicons/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { DateDmyPipe } from '@app/shared/pipes/date-dmy.pipe';
import { Post } from '@app/data/types';

@Component({
  selector: 'app-post-view-modal',
  templateUrl: 'post-view.modal.html',
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

  protected readonly globeOutline = globeOutline;
  protected readonly personCircleOutline = personCircleOutline;
  protected readonly timeOutline = timeOutline;

  constructor() {
    addIcons({ 'close-outline': closeOutline });
  }

  close(): void {
    this.modalCtrl.dismiss();
  }
}

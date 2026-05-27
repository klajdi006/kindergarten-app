import { Component, Input, inject } from '@angular/core';
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
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';

@Component({
  selector: 'app-pdf-viewer-modal',
  templateUrl: 'pdf-viewer.modal.html',
  styleUrl: 'pdf-viewer.modal.scss',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonIcon,
    NgxExtendedPdfViewerModule,
  ],
})
export class PdfViewerModal {
  private readonly modalCtrl = inject(ModalController);

  /** Firebase download URL of the PDF. */
  @Input({ required: true }) src!: string;
  /** Original file name, shown in the toolbar and used for downloads. */
  @Input() name = 'document.pdf';

  constructor() {
    addIcons({ 'close-outline': closeOutline });
  }

  close(): void {
    this.modalCtrl.dismiss();
  }
}

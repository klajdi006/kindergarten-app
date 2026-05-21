import { Component, Input, inject } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { bandageOutline, closeOutline, sunnyOutline } from 'ionicons/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { DateDmyPipe } from '@app/shared/pipes/date-dmy.pipe';
import { Absence } from '@app/data/types';

@Component({
  selector: 'app-absence-history-modal',
  templateUrl: 'absence-history.modal.html',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonText,
    TranslatePipe,
    DateDmyPipe,
  ],
})
export class AbsenceHistoryModal {
  private readonly modalCtrl = inject(ModalController);

  @Input() history: Absence[] = [];

  protected readonly bandageOutline = bandageOutline;
  protected readonly sunnyOutline = sunnyOutline;

  constructor() {
    addIcons({ 'close-outline': closeOutline });
  }

  close(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }
}

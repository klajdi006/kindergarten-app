import { Component, Input, OnInit, inject, signal } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  businessOutline,
  calendarOutline,
  closeOutline,
  femaleOutline,
  flaskOutline,
  happyOutline,
  maleOutline,
  medkitOutline,
  peopleOutline,
} from 'ionicons/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { take } from 'rxjs';
import { DepartmentsService } from '@app/data/departments.service';
import { HealthService } from '@app/data/health.service';
import { Child, ChildHealth } from '@app/data/types';
import { DateDmyPipe } from '@app/shared/pipes/date-dmy.pipe';

@Component({
  selector: 'app-employee-child-detail-modal',
  templateUrl: 'employee-child-detail.modal.html',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonIcon,
    IonText,
    TranslatePipe,
    DateDmyPipe,
  ],
})
export class EmployeeChildDetailModal implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly healthService = inject(HealthService);
  private readonly departments = inject(DepartmentsService);

  @Input({ required: true }) child!: Child;

  readonly healthProfile = signal<ChildHealth | null>(null);

  constructor() {
    addIcons({
      'close-outline': closeOutline,
      'happy-outline': happyOutline,
      'calendar-outline': calendarOutline,
      'business-outline': businessOutline,
      'male-outline': maleOutline,
      'female-outline': femaleOutline,
      'medkit-outline': medkitOutline,
      'alert-circle-outline': alertCircleOutline,
      'people-outline': peopleOutline,
      'flask-outline': flaskOutline,
    });
  }

  ngOnInit(): void {
    this.healthService.forChild(this.child.id).pipe(take(1)).subscribe((h) => {
      this.healthProfile.set(h);
    });
  }

  get departmentName(): string {
    const deptId = this.child?.departmentId;
    if (!deptId) return '';
    return this.departments.all().find((d) => d.id === deptId)?.name ?? '';
  }

  get childAge(): number | null {
    const birth = new Date(this.child.birthDate);
    if (Number.isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age >= 0 ? age : null;
  }

  initials(): string {
    const c = this.child;
    return [c.firstName?.[0], c.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?';
  }

  close(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }
}

import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  alertCircleOutline,
  closeOutline,
  flaskOutline,
  medkitOutline,
  peopleOutline,
  personOutline,
  trashOutline,
} from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs';
import { HealthService } from '@app/data/health.service';
import { ChildHealth, EmergencyContact, Medication, Parent } from '@app/data/types';

@Component({
  selector: 'app-health-profile-modal',
  templateUrl: 'health-profile.modal.html',
  imports: [
    ReactiveFormsModule,
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
    IonInput,
    IonNote,
    IonTextarea,
    TranslatePipe,
  ],
})
export class HealthProfileModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly healthService = inject(HealthService);
  private readonly t = inject(TranslateService);

  @Input({ required: true }) childId!: string;
  @Input() linkedParents: Parent[] = [];

  readonly saving = signal(false);
  readonly contacts = signal<EmergencyContact[]>([]);
  readonly allergies = signal<string[]>([]);
  readonly medications = signal<Medication[]>([]);
  readonly allergyInput = signal('');

  readonly form = this.fb.nonNullable.group({
    bloodType: [''],
    doctorName: [''],
    doctorPhone: [''],
    medicalConditions: [''],
    notes: [''],
  });

  readonly newContactForm = this.fb.nonNullable.group({
    name: [''],
    relationship: [''],
    phone: [''],
  });

  readonly newMedicationForm = this.fb.nonNullable.group({
    name: [''],
    dosage: [''],
    frequency: [''],
  });

  constructor() {
    addIcons({
      'close-outline': closeOutline,
      'add-outline': addOutline,
      'trash-outline': trashOutline,
      'medkit-outline': medkitOutline,
      'alert-circle-outline': alertCircleOutline,
      'people-outline': peopleOutline,
      'person-outline': personOutline,
      'flask-outline': flaskOutline,
    });
  }

  ngOnInit(): void {
    this.healthService.forChild(this.childId).pipe(take(1)).subscribe((profile) => {
      if (!profile) return;
      this.contacts.set(profile.emergencyContacts ?? []);
      this.allergies.set(profile.allergies ?? []);
      this.medications.set(profile.medications ?? []);
      this.form.patchValue({
        bloodType: profile.bloodType ?? '',
        doctorName: profile.doctorName ?? '',
        doctorPhone: profile.doctorPhone ?? '',
        medicalConditions: profile.medicalConditions ?? '',
        notes: profile.notes ?? '',
      });
    });
  }

  prefillFromParent(parent: Parent): void {
    const relationship =
      parent.gender === 'male'
        ? this.t.instant('admin.parents.gender.male')
        : parent.gender === 'female'
          ? this.t.instant('admin.parents.gender.female')
          : '';
    this.newContactForm.patchValue({
      name: `${parent.firstName} ${parent.lastName}`.trim(),
      phone: parent.phone ?? '',
      relationship,
    });
  }

  addContact(): void {
    const { name, relationship, phone } = this.newContactForm.getRawValue();
    if (!name.trim() && !phone.trim()) return;
    this.contacts.update((c) => [
      ...c,
      { name: name.trim(), relationship: relationship.trim(), phone: phone.trim() },
    ]);
    this.newContactForm.reset({ name: '', relationship: '', phone: '' });
  }

  removeContact(index: number): void {
    this.contacts.update((c) => c.filter((_, i) => i !== index));
  }

  addAllergy(): void {
    const val = this.allergyInput().trim();
    if (!val) return;
    this.allergies.update((a) => [...a, val]);
    this.allergyInput.set('');
  }

  removeAllergy(index: number): void {
    this.allergies.update((a) => a.filter((_, i) => i !== index));
  }

  addMedication(): void {
    const { name, dosage, frequency } = this.newMedicationForm.getRawValue();
    if (!name.trim()) return;
    this.medications.update((m) => [
      ...m,
      { name: name.trim(), dosage: dosage.trim(), frequency: frequency.trim() },
    ]);
    this.newMedicationForm.reset({ name: '', dosage: '', frequency: '' });
  }

  removeMedication(index: number): void {
    this.medications.update((m) => m.filter((_, i) => i !== index));
  }

  onAllergyInput(event: Event): void {
    this.allergyInput.set((event as CustomEvent).detail.value ?? '');
  }

  cancel(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  async save(): Promise<void> {
    this.saving.set(true);
    try {
      const { bloodType, doctorName, doctorPhone, medicalConditions, notes } =
        this.form.getRawValue();
      const profile: Omit<ChildHealth, 'updatedAt' | 'updatedByUid'> = {
        emergencyContacts: this.contacts(),
        allergies: this.allergies(),
        medications: this.medications(),
        bloodType: bloodType.trim() || null,
        doctorName: doctorName.trim() || null,
        doctorPhone: doctorPhone.trim() || null,
        medicalConditions: medicalConditions.trim() || null,
        notes: notes.trim() || null,
      };
      await this.healthService.save(this.childId, profile);
      const toast = await this.toastCtrl.create({
        message: this.t.instant('health.saved'),
        duration: 2000,
        color: 'success',
        position: 'bottom',
      });
      await toast.present();
      this.modalCtrl.dismiss(null, 'confirm');
    } finally {
      this.saving.set(false);
    }
  }
}

import { Component, Input, computed, signal } from '@angular/core';
import { inject } from '@angular/core';
import {
  IonAvatar,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircle, closeOutline, ellipseOutline } from 'ionicons/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { DateDmyPipe } from '@app/shared/pipes/date-dmy.pipe';
import { Child } from '@app/data/types';

export interface AssignChildrenResult {
  selectedIds: string[];
}

@Component({
  selector: 'app-assign-children-modal',
  templateUrl: 'assign-children.modal.html',
  styleUrl: './assign-children.modal.scss',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonSearchbar,
    IonList,
    IonItem,
    IonAvatar,
    IonLabel,
    IonIcon,
    IonText,
    TranslatePipe,
    DateDmyPipe,
  ],
})
export class AssignChildrenModal {
  private readonly modalCtrl = inject(ModalController);

  @Input({ required: true }) available: Child[] = [];

  readonly search = signal('');
  readonly selectedIds = signal<Set<string>>(new Set());

  constructor() {
    addIcons({
      'close-outline': closeOutline,
      'checkmark-circle': checkmarkCircle,
      'ellipse-outline': ellipseOutline,
    });
  }

  readonly sorted = computed<Child[]>(() =>
    [...this.available].sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
    ),
  );

  readonly filtered = computed<Child[]>(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.sorted();
    return this.sorted().filter((c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q),
    );
  });

  readonly selectedCount = computed(() => this.selectedIds().size);

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggle(id: string): void {
    const next = new Set(this.selectedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedIds.set(next);
  }

  onSearch(event: CustomEvent): void {
    const value = (event.detail as { value?: string }).value ?? '';
    this.search.set(value);
  }

  initials(child: Child): string {
    return (
      [child.firstName?.[0], child.lastName?.[0]]
        .filter(Boolean)
        .join('')
        .toUpperCase() || '?'
    );
  }

  childAge(child: Child): number | null {
    if (!child.birthDate) return null;
    const birth = new Date(child.birthDate);
    if (Number.isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age >= 0 ? age : null;
  }

  cancel(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm(): void {
    if (this.selectedCount() === 0) return;
    const result: AssignChildrenResult = {
      selectedIds: Array.from(this.selectedIds()),
    };
    this.modalCtrl.dismiss(result, 'confirm');
  }
}

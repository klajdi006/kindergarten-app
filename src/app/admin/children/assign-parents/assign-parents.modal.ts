import { Component, Input, computed, inject, signal } from '@angular/core';
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
import { Parent } from '@app/data/types';

export interface AssignParentsResult {
  selectedIds: string[];
}

@Component({
  selector: 'app-assign-parents-modal',
  templateUrl: 'assign-parents.modal.html',
  styleUrl: './assign-parents.modal.scss',
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
  ],
})
export class AssignParentsModal {
  private readonly modalCtrl = inject(ModalController);

  @Input({ required: true }) available: Parent[] = [];

  readonly search = signal('');
  readonly selectedIds = signal<Set<string>>(new Set());

  constructor() {
    addIcons({
      'close-outline': closeOutline,
      'checkmark-circle': checkmarkCircle,
      'ellipse-outline': ellipseOutline,
    });
  }

  readonly sorted = computed<Parent[]>(() =>
    [...this.available].sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
    ),
  );

  readonly filtered = computed<Parent[]>(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.sorted();
    return this.sorted().filter(
      (p) =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q),
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

  initials(parent: Parent): string {
    return (
      [parent.firstName?.[0], parent.lastName?.[0]]
        .filter(Boolean)
        .join('')
        .toUpperCase() || '?'
    );
  }

  cancel(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm(): void {
    if (this.selectedCount() === 0) return;
    const result: AssignParentsResult = {
      selectedIds: Array.from(this.selectedIds()),
    };
    this.modalCtrl.dismiss(result, 'confirm');
  }
}

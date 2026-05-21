import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  IonAvatar,
  IonBadge,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonSearchbar,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkCircle,
  closeOutline,
  ellipseOutline,
  peopleOutline,
} from 'ionicons/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '@app/auth/auth.service';
import { ParentsService } from '@app/data/parents.service';
import { StaffService } from '@app/data/staff.service';
import { ConversationRole } from '@app/data/types';

export interface NewConversationParticipant {
  uid: string;
  name: string;
  role: ConversationRole;
}

export interface NewConversationResult {
  participants: NewConversationParticipant[];
  title: string | null;
}

type Mode = 'browse' | 'group';

@Component({
  selector: 'app-new-conversation-modal',
  templateUrl: 'new-conversation.modal.html',
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonSearchbar,
    IonList,
    IonListHeader,
    IonItem,
    IonAvatar,
    IonLabel,
    IonBadge,
    IonChip,
    IonIcon,
    IonInput,
    IonText,
    TranslatePipe,
  ],
})
export class NewConversationModal {
  private readonly modalCtrl = inject(ModalController);
  private readonly auth = inject(AuthService);
  private readonly staff = inject(StaffService);
  private readonly parents = inject(ParentsService);
  private readonly fb = inject(FormBuilder);

  readonly mode = signal<Mode>('browse');
  readonly search = signal('');
  readonly selected = signal<NewConversationParticipant[]>([]);

  readonly groupForm = this.fb.nonNullable.group({
    title: [''],
  });

  protected readonly checkmarkCircle = checkmarkCircle;
  protected readonly ellipseOutline = ellipseOutline;
  protected readonly peopleOutline = peopleOutline;

  constructor() {
    addIcons({ 'close-outline': closeOutline });
  }

  readonly directory = computed<NewConversationParticipant[]>(() => {
    const me = this.auth.currentUser()?.uid;
    const list: NewConversationParticipant[] = [];
    for (const s of this.staff.all()) {
      if (s.claimedByUid && s.claimedByUid !== me) {
        list.push({
          uid: s.claimedByUid,
          name: `${s.firstName} ${s.lastName}`.trim(),
          role: s.role,
        });
      }
    }
    for (const p of this.parents.all()) {
      if (p.claimedByUid && p.claimedByUid !== me) {
        list.push({
          uid: p.claimedByUid,
          name: `${p.firstName} ${p.lastName}`.trim(),
          role: 'parent',
        });
      }
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly filtered = computed<NewConversationParticipant[]>(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.directory();
    return this.directory().filter((p) => p.name.toLowerCase().includes(q));
  });

  isSelected(uid: string): boolean {
    return this.selected().some((p) => p.uid === uid);
  }

  initials(name: string): string {
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('') || '?'
    );
  }

  firstName(name: string): string {
    return name.split(/\s+/)[0] || name;
  }

  roleColor(role: ConversationRole): string {
    if (role === 'admin') return 'primary';
    if (role === 'employee') return 'success';
    return 'tertiary';
  }

  startGroupMode(): void {
    this.mode.set('group');
    this.selected.set([]);
    this.groupForm.reset({ title: '' });
  }

  exitGroupMode(): void {
    this.mode.set('browse');
    this.selected.set([]);
    this.groupForm.reset({ title: '' });
  }

  cancel(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  onHeaderLeft(): void {
    // In group mode the leading button goes back to browse; in browse it closes.
    if (this.mode() === 'group') {
      this.exitGroupMode();
    } else {
      this.cancel();
    }
  }

  onSearch(event: CustomEvent): void {
    const value = (event.detail as { value?: string }).value ?? '';
    this.search.set(value);
  }

  /** Browse-mode tap: open a 1:1 immediately. */
  pickOne(p: NewConversationParticipant): void {
    const result: NewConversationResult = { participants: [p], title: null };
    this.modalCtrl.dismiss(result, 'confirm');
  }

  /** Group-mode tap: toggle in/out of the selected list. */
  toggleForGroup(p: NewConversationParticipant): void {
    const current = this.selected();
    if (current.some((x) => x.uid === p.uid)) {
      this.selected.set(current.filter((x) => x.uid !== p.uid));
    } else {
      this.selected.set([...current, p]);
    }
  }

  removeFromGroup(p: NewConversationParticipant): void {
    this.selected.set(this.selected().filter((x) => x.uid !== p.uid));
  }

  createGroup(): void {
    if (this.selected().length === 0) return;
    const result: NewConversationResult = {
      participants: this.selected(),
      title: this.groupForm.controls.title.value.trim() || null,
    };
    this.modalCtrl.dismiss(result, 'confirm');
  }
}

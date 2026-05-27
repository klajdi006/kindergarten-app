import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonAvatar,
  IonBadge,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, chatbubblesOutline, peopleOutline } from 'ionicons/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '@app/auth/auth.service';
import { ConversationsService } from '@app/data/conversations.service';
import { NotificationsService } from '@app/data/notifications.service';
import { Conversation } from '@app/data/types';
import { completeRefresher } from '@app/shared/utils/refresher';
import {
  NewConversationModal,
  NewConversationResult,
} from '@app/shared/components/messages/new-conversation/new-conversation.modal';
import { SkeletonListComponent } from '@app/shared/components/skeleton-list/skeleton-list.component';

@Component({
  selector: 'app-messages-list',
  templateUrl: 'messages-list.page.html',
  styleUrl: './messages-list.page.scss',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonList,
    IonItem,
    IonLabel,
    IonAvatar,
    IonBadge,
    IonText,
    IonIcon,
    IonFab,
    IonFabButton,
    TranslatePipe,
    SkeletonListComponent,
  ],
})
export class MessagesListPage {
  private readonly modalCtrl = inject(ModalController);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  readonly conversations = inject(ConversationsService);
  readonly notifications = inject(NotificationsService);

  protected readonly onRefresh = completeRefresher;

  readonly loading = signal(true);

  constructor() {
    addIcons({
      'add-outline': addOutline,
      'chatbubbles-outline': chatbubblesOutline,
      'people-outline': peopleOutline,
    });
    effect(() => {
      if (this.conversations.mine().length > 0) this.loading.set(false);
    });
    setTimeout(() => this.loading.set(false), 1500);
  }

  readonly myUid = computed(() => this.auth.currentUser()?.uid ?? null);

  displayTitle(conv: Conversation): string {
    if (conv.isGroup) {
      if (conv.title) return conv.title;
      const me = this.myUid();
      return conv.participantIds
        .filter((id) => id !== me)
        .map((id) => conv.participantNames[id] ?? '')
        .filter(Boolean)
        .join(', ');
    }
    const me = this.myUid();
    const otherId = conv.participantIds.find((id) => id !== me);
    return otherId ? conv.participantNames[otherId] ?? '' : '';
  }

  initials(text: string): string {
    return (
      text
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('') || '?'
    );
  }

  otherRoleBadge(conv: Conversation): string | null {
    if (conv.isGroup) return null;
    const me = this.myUid();
    const otherId = conv.participantIds.find((id) => id !== me);
    return otherId ? conv.participantRoles[otherId] ?? null : null;
  }

  open(conv: Conversation): void {
    this.router.navigate([conv.id], { relativeTo: this.route });
  }

  async openNew(): Promise<void> {
    const modal = await this.modalCtrl.create({ component: NewConversationModal });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<NewConversationResult>();
    if (role !== 'confirm' || !data || data.participants.length === 0) return;

    let conversationId: string;
    if (data.participants.length === 1) {
      conversationId = await this.conversations.findOrCreate1on1(data.participants[0]);
    } else {
      conversationId = await this.conversations.createGroup(data.participants, data.title);
    }
    this.router.navigate([conversationId], { relativeTo: this.route });
  }
}

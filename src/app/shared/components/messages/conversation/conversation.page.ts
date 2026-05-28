import {
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ActionSheetController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonSkeletonText,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  attachOutline,
  cameraOutline,
  closeCircleOutline,
  documentOutline,
  imageOutline,
  sendOutline,
} from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { of, switchMap } from 'rxjs';
import { AuthService } from '@app/auth/auth.service';
import { ConversationsService } from '@app/data/conversations.service';
import { Message, MessageAttachment } from '@app/data/types';
import { isIosPwa } from '@app/shared/utils/platform';

interface PendingAttachment {
  file: File;
  localUrl: string;
  name: string;
  attachType: 'image' | 'file';
}

@Component({
  selector: 'app-conversation',
  templateUrl: 'conversation.page.html',
  styleUrl: './conversation.page.scss',
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonContent,
    IonFooter,
    IonTextarea,
    IonIcon,
    IonSkeletonText,
    IonText,
    TranslatePipe,
  ],
})
export class ConversationPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toastCtrl = inject(ToastController);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly t = inject(TranslateService);
  readonly conversations = inject(ConversationsService);

  @ViewChild('imageInput') private readonly imageInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('cameraInput') private readonly cameraInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('fileInput') private readonly fileInputRef?: ElementRef<HTMLInputElement>;

  readonly listUrl = computed(() => {
    const url = this.router.url;
    const idx = url.lastIndexOf('/');
    return idx > 0 ? url.slice(0, idx) : '/';
  });

  @ViewChild(IonContent) private readonly content?: IonContent;

  private readonly conversationId = toSignal(
    this.route.paramMap.pipe(switchMap((p) => of(p.get('id')))),
    { initialValue: null as string | null },
  );

  readonly conversation = computed(() => {
    const id = this.conversationId();
    return id ? this.conversations.byId(id)() : null;
  });

  readonly messages = toSignal(
    toObservable(this.conversationId).pipe(
      switchMap((id) => (id ? this.conversations.messagesFor(id) : of<Message[]>([]))),
    ),
    { initialValue: [] as Message[] },
  );

  readonly myUid = computed(() => this.auth.currentUser()?.uid ?? null);

  readonly form = this.fb.nonNullable.group({ text: [''] });

  readonly sending = signal(false);
  readonly pendingFiles = signal<PendingAttachment[]>([]);
  readonly loading = signal(true);

  protected readonly skeletonBubbles = [
    { mine: false, width: '70%' },
    { mine: true, width: '55%' },
    { mine: false, width: '60%' },
    { mine: true, width: '75%' },
    { mine: false, width: '50%' },
  ];

  protected readonly iosPwa = isIosPwa();
  readonly keyboardOpen = signal(false);

  private lastMessageCount = 0;
  private didInitialScroll = false;

  constructor() {
    addIcons({
      'send-outline': sendOutline,
      'attach-outline': attachOutline,
      'camera-outline': cameraOutline,
      'image-outline': imageOutline,
      'document-outline': documentOutline,
      'close-circle-outline': closeCircleOutline,
    });

    effect(() => {
      const id = this.conversationId();
      if (id) void this.conversations.markRead(id);
    });

    effect(() => {
      const count = this.messages().length;
      if (count > this.lastMessageCount) {
        const instant = !this.didInitialScroll;
        this.didInitialScroll = true;
        setTimeout(() => this.scrollToBottom(instant ? 0 : 200), 0);
        const id = this.conversationId();
        if (id) void this.conversations.markRead(id);
      }
      this.lastMessageCount = count;
    });

    effect(() => {
      if (this.messages().length > 0) this.loading.set(false);
    });
    setTimeout(() => this.loading.set(false), 1500);

    if (Capacitor.isNativePlatform()) {
      const handles = [
        Keyboard.addListener('keyboardWillShow', () => this.keyboardOpen.set(true)),
        Keyboard.addListener('keyboardWillHide', () => this.keyboardOpen.set(false)),
      ];
      inject(DestroyRef).onDestroy(async () => {
        for (const handle of handles) (await handle).remove();
      });
    }
  }

  title(): string {
    const c = this.conversation();
    if (!c) return '';
    if (c.isGroup) {
      if (c.title) return c.title;
      const me = this.myUid();
      return c.participantIds
        .filter((id) => id !== me)
        .map((id) => c.participantNames[id] ?? '')
        .filter(Boolean)
        .join(', ');
    }
    const me = this.myUid();
    const otherId = c.participantIds.find((id) => id !== me);
    return otherId ? c.participantNames[otherId] ?? '' : '';
  }

  isMine(msg: Message): boolean {
    return msg.authorUid === this.myUid();
  }

  isGroup(): boolean {
    return this.conversation()?.isGroup ?? false;
  }

  showAuthor(index: number): boolean {
    if (index === 0) return true;
    const list = this.messages();
    return list[index].authorUid !== list[index - 1].authorUid;
  }

  hasAttachments(msg: Message): boolean {
    return (msg.attachments?.length ?? 0) > 0;
  }

  images(msg: Message): MessageAttachment[] {
    return msg.attachments?.filter((a) => a.type === 'image') ?? [];
  }

  files(msg: Message): MessageAttachment[] {
    return msg.attachments?.filter((a) => a.type === 'file') ?? [];
  }

  async send(): Promise<void> {
    const text = this.form.controls.text.value.trim();
    const files = this.pendingFiles();
    if ((!text && files.length === 0) || this.sending()) return;
    const cid = this.conversationId();
    if (!cid) return;

    this.sending.set(true);
    this.form.reset({ text: '' });

    let uploaded: MessageAttachment[] = [];
    try {
      if (files.length > 0) {
        uploaded = await this.conversations.uploadAttachments(
          files.map((f) => f.file),
          cid,
        );
        for (const f of files) if (f.localUrl) URL.revokeObjectURL(f.localUrl);
        this.pendingFiles.set([]);
      }
      await this.conversations.sendMessage(cid, text, uploaded);
    } catch {
      this.form.controls.text.setValue(text);
      const toast = await this.toastCtrl.create({
        message: this.t.instant('messages.sendFailed'),
        duration: 2500,
        color: 'danger',
        position: 'bottom',
      });
      await toast.present();
    } finally {
      this.sending.set(false);
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.send();
    }
  }

  async openAttachPicker(): Promise<void> {
    const sheet = await this.actionSheetCtrl.create({
      buttons: [
        {
          text: this.t.instant('messages.attachCamera'),
          icon: 'camera-outline',
          handler: () => {
            this.cameraInputRef?.nativeElement.click();
          },
        },
        {
          text: this.t.instant('messages.attachImage'),
          icon: 'image-outline',
          handler: () => {
            this.imageInputRef?.nativeElement.click();
          },
        },
        {
          text: this.t.instant('messages.attachFile'),
          icon: 'document-outline',
          handler: () => {
            this.fileInputRef?.nativeElement.click();
          },
        },
        { text: this.t.instant('common.cancel'), role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  onFilePick(event: Event, type: 'image' | 'file'): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    const pending: PendingAttachment[] = files.map((file) => ({
      file,
      localUrl: type === 'image' ? URL.createObjectURL(file) : '',
      name: file.name,
      attachType: type,
    }));
    this.pendingFiles.update((prev) => [...prev, ...pending]);
    input.value = '';
  }

  removeAttachment(idx: number): void {
    const removed = this.pendingFiles()[idx];
    if (removed.localUrl) URL.revokeObjectURL(removed.localUrl);
    this.pendingFiles.update((prev) => prev.filter((_, i) => i !== idx));
  }

  private scrollToBottom(duration: number): void {
    this.content?.scrollToBottom(duration);
  }
}

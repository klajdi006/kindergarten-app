import { Injectable, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  doc,
  orderBy,
  query,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import {
  Storage,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from '@angular/fire/storage';
import { Observable, of, switchMap } from 'rxjs';
import { AuthService } from '@app/auth/auth.service';
import { Conversation, ConversationRole, Message, MessageAttachment } from '@app/data/types';
import { compressImage } from '@app/shared/utils/image';

export interface ChatParticipant {
  uid: string;
  name: string;
  role: ConversationRole;
}

@Injectable({ providedIn: 'root' })
export class ConversationsService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);
  private readonly auth = inject(AuthService);

  private readonly uid = computed(() => this.auth.currentUser()?.uid ?? null);
  private readonly kgId = computed(() => this.auth.kindergartenId());

  readonly mine = toSignal(
    toObservable(
      computed(() => ({ uid: this.uid(), kgId: this.kgId() })),
    ).pipe(
      switchMap(({ uid, kgId }) => {
        if (!uid || !kgId) return of<Conversation[]>([]);
        const q = query(
          collection(this.firestore, 'conversations'),
          where('kindergartenId', '==', kgId),
          where('participantIds', 'array-contains', uid),
          orderBy('lastMessageAt', 'desc'),
        );
        return collectionData(q, { idField: 'id' }) as Observable<Conversation[]>;
      }),
    ),
    { initialValue: [] as Conversation[] },
  );

  readonly count = computed(() => this.mine().length);

  byId(id: string) {
    return computed(() => this.mine().find((c) => c.id === id) ?? null);
  }

  messagesFor(conversationId: string): Observable<Message[]> {
    const q = query(
      collection(this.firestore, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'asc'),
    );
    return collectionData(q, { idField: 'id' }) as Observable<Message[]>;
  }

  /**
   * Open or create a 1:1 conversation with the given user. Returns the
   * conversation id.
   */
  async findOrCreate1on1(other: ChatParticipant): Promise<string> {
    const uid = this.uid();
    const kgId = this.kgId();
    const myName = this.auth.currentUser()?.displayName ?? '';
    const myRole = this.auth.role() as ConversationRole | null;
    if (!uid || !kgId || !myRole) throw new Error('Not signed in');
    if (other.uid === uid) throw new Error('Cannot message yourself');

    const existing = this.mine().find(
      (c) =>
        !c.isGroup &&
        c.participantIds.length === 2 &&
        c.participantIds.includes(other.uid) &&
        c.participantIds.includes(uid),
    );
    if (existing) return existing.id;

    const now = Date.now();
    const ref = await addDoc(collection(this.firestore, 'conversations'), {
      kindergartenId: kgId,
      participantIds: [uid, other.uid],
      participantNames: { [uid]: myName, [other.uid]: other.name },
      participantRoles: { [uid]: myRole, [other.uid]: other.role },
      isGroup: false,
      title: null,
      lastMessage: null,
      lastMessageAt: now,
      lastMessageAuthorUid: null,
      createdAt: now,
      createdByUid: uid,
    });
    return ref.id;
  }

  async createGroup(others: ChatParticipant[], title: string | null = null): Promise<string> {
    const uid = this.uid();
    const kgId = this.kgId();
    const myName = this.auth.currentUser()?.displayName ?? '';
    const myRole = this.auth.role() as ConversationRole | null;
    if (!uid || !kgId || !myRole) throw new Error('Not signed in');
    if (others.length === 0) throw new Error('Group needs at least one other');

    const all: ChatParticipant[] = [
      { uid, name: myName, role: myRole },
      ...others,
    ];
    const participantIds = all.map((p) => p.uid);
    const participantNames: Record<string, string> = {};
    const participantRoles: Record<string, ConversationRole> = {};
    for (const p of all) {
      participantNames[p.uid] = p.name;
      participantRoles[p.uid] = p.role;
    }

    const now = Date.now();
    const ref = await addDoc(collection(this.firestore, 'conversations'), {
      kindergartenId: kgId,
      participantIds,
      participantNames,
      participantRoles,
      isGroup: true,
      title: title?.trim() || null,
      lastMessage: null,
      lastMessageAt: now,
      lastMessageAuthorUid: null,
      createdAt: now,
      createdByUid: uid,
    });
    return ref.id;
  }

  async markRead(conversationId: string): Promise<void> {
    const uid = this.uid();
    if (!uid) return;
    await updateDoc(doc(this.firestore, 'conversations', conversationId), {
      [`lastReadAt.${uid}`]: Date.now(),
    });
  }

  async sendMessage(
    conversationId: string,
    text: string,
    attachments: MessageAttachment[] = [],
  ): Promise<void> {
    const uid = this.uid();
    const myName = this.auth.currentUser()?.displayName ?? null;
    if (!uid) throw new Error('Not signed in');
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;

    const now = Date.now();
    const msgData: Record<string, unknown> = {
      authorUid: uid,
      authorName: myName,
      text: trimmed,
      createdAt: now,
    };
    if (attachments.length > 0) msgData['attachments'] = attachments;

    await addDoc(
      collection(this.firestore, 'conversations', conversationId, 'messages'),
      msgData,
    );
    const preview = trimmed || attachments[0].name;
    await updateDoc(doc(this.firestore, 'conversations', conversationId), {
      lastMessage: preview,
      lastMessageAt: now,
      lastMessageAuthorUid: uid,
      [`lastReadAt.${uid}`]: now,
    });
  }

  async uploadAttachments(files: File[], conversationId: string): Promise<MessageAttachment[]> {
    return Promise.all(files.map((file) => this.uploadOneAttachment(file, conversationId)));
  }

  private async uploadOneAttachment(file: File, conversationId: string): Promise<MessageAttachment> {
    const isImage = file.type.startsWith('image/');
    const toUpload = isImage ? await compressImage(file) : file;
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ext = file.name.split('.').pop()?.toLowerCase();
    const storagePath = `conversations/${conversationId}/${id}${ext ? '.' + ext : ''}`;
    const storageRef = ref(this.storage, storagePath);
    const task = uploadBytesResumable(storageRef, toUpload, {
      contentType: toUpload.type || undefined,
    });
    await new Promise<void>((resolve, reject) =>
      task.on('state_changed', undefined, reject, () => resolve()),
    );
    const url = await getDownloadURL(task.snapshot.ref);
    return { url, name: file.name, type: isImage ? 'image' : 'file', storagePath };
  }
}

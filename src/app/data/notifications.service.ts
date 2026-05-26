import { Injectable, computed, inject } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { AuthService } from '@app/auth/auth.service';
import { AbsencesService } from '@app/data/absences.service';
import { ChildrenService } from '@app/data/children.service';
import { ConversationsService } from '@app/data/conversations.service';
import { ParentsService } from '@app/data/parents.service';
import { PostsService } from '@app/data/posts.service';
import { StaffService } from '@app/data/staff.service';
import { Child } from '@app/data/types';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly auth = inject(AuthService);
  private readonly conversations = inject(ConversationsService);
  private readonly posts = inject(PostsService);
  private readonly absences = inject(AbsencesService);
  private readonly parents = inject(ParentsService);
  private readonly staff = inject(StaffService);
  private readonly children = inject(ChildrenService);

  private readonly uid = computed(() => this.auth.currentUser()?.uid ?? null);

  readonly unreadConversationsCount = computed(() => {
    const uid = this.uid();
    if (!uid) return 0;
    return this.conversations.mine().filter((c) => {
      const lastRead = c.lastReadAt?.[uid] ?? 0;
      return c.lastMessageAt > lastRead && c.lastMessageAuthorUid !== uid;
    }).length;
  });

  isConversationUnread(conversationId: string): boolean {
    const uid = this.uid();
    if (!uid) return false;
    const conv = this.conversations.mine().find((c) => c.id === conversationId);
    if (!conv) return false;
    const lastRead = conv.lastReadAt?.[uid] ?? 0;
    return conv.lastMessageAt > lastRead && conv.lastMessageAuthorUid !== uid;
  }

  // --- Parent posts ----------------------------------------------------------

  private readonly parentChildren = toSignal(
    toObservable(this.parents.currentParent).pipe(
      switchMap((p) => (p ? this.children.forParent(p.id) : of<Child[]>([]))),
    ),
    { initialValue: [] as Child[] },
  );

  private readonly parentDeptIds = computed(() =>
    new Set(
      this.parentChildren()
        .map((c) => c.departmentId)
        .filter((id): id is string => !!id),
    ),
  );

  readonly parentUnreadPostsCount = computed(() => {
    const me = this.parents.currentParent();
    if (!me) return 0;
    const baseline = me.lastSeenPostsAt ?? me.createdAt;
    const deptIds = this.parentDeptIds();
    const seen = new Set(me.seenPostIds ?? []);
    return this.posts.all().filter((p) => {
      if (p.createdAt <= baseline) return false;
      if (seen.has(p.id)) return false;
      return p.departmentId === null || deptIds.has(p.departmentId);
    }).length;
  });

  isParentPostUnread(postId: string): boolean {
    const me = this.parents.currentParent();
    if (!me) return false;
    const post = this.posts.all().find((p) => p.id === postId);
    if (!post) return false;
    const baseline = me.lastSeenPostsAt ?? me.createdAt;
    if (post.createdAt <= baseline) return false;
    return !(me.seenPostIds ?? []).includes(postId);
  }

  // --- Staff posts -----------------------------------------------------------

  readonly staffUnreadPostsCount = computed(() => {
    const me = this.staff.currentStaff();
    if (!me) return 0;
    const baseline = me.lastSeenPostsAt ?? me.createdAt;
    const seen = new Set(me.seenPostIds ?? []);
    return this.posts.all().filter(
      (p) => p.createdAt > baseline && !seen.has(p.id),
    ).length;
  });

  isStaffPostUnread(postId: string): boolean {
    const me = this.staff.currentStaff();
    if (!me) return false;
    const post = this.posts.all().find((p) => p.id === postId);
    if (!post) return false;
    const baseline = me.lastSeenPostsAt ?? me.createdAt;
    if (post.createdAt <= baseline) return false;
    return !(me.seenPostIds ?? []).includes(postId);
  }

  // --- Staff sick ------------------------------------------------------------

  private readonly staffChildren = toSignal(
    toObservable(this.staff.currentStaff).pipe(
      switchMap((s) => (s ? this.children.forStaff(s) : of<Child[]>([]))),
    ),
    { initialValue: [] as Child[] },
  );

  private readonly staffChildIds = computed(
    () => new Set(this.staffChildren().map((c) => c.id)),
  );

  readonly staffUnreadSickCount = computed(() => {
    const me = this.staff.currentStaff();
    if (!me) return 0;
    const baseline = me.lastSeenSickAt ?? me.createdAt;
    const accessibleIds = this.staffChildIds();
    return this.absences.all().filter(
      (a) =>
        a.type === 'sick' &&
        a.createdAt > baseline &&
        accessibleIds.has(a.childId),
    ).length;
  });
}

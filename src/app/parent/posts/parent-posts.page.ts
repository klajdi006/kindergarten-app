import { Component, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
  IonSkeletonText,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { funnelOutline, newspaperOutline } from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { of, switchMap } from 'rxjs';
import { DateDmyPipe } from '@app/shared/pipes/date-dmy.pipe';
import { ChildrenService } from '@app/data/children.service';
import { DepartmentsService } from '@app/data/departments.service';
import { NotificationsService } from '@app/data/notifications.service';
import { ParentsService } from '@app/data/parents.service';
import { PostsService } from '@app/data/posts.service';
import { Child, Department, Post } from '@app/data/types';
import { PostViewModal } from '@app/shared/components/post-view/post-view.modal';
import { completeRefresher } from '@app/shared/utils/refresher';

@Component({
  selector: 'app-parent-posts',
  templateUrl: 'parent-posts.page.html',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonItem,
    IonRefresher,
    IonRefresherContent,
    IonSelect,
    IonSelectOption,
    IonText,
    IonCard,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonCardContent,
    IonIcon,
    IonSkeletonText,
    TranslatePipe,
    DateDmyPipe,
  ],
})
export class ParentPostsPage {
  private readonly parents = inject(ParentsService);
  private readonly children = inject(ChildrenService);
  private readonly posts = inject(PostsService);
  private readonly departments = inject(DepartmentsService);
  readonly notifications = inject(NotificationsService);
  private readonly t = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly modalCtrl = inject(ModalController);

  readonly flashingPostId = signal<string | null>(null);

  readonly parent = this.parents.currentParent;

  protected readonly onRefresh = completeRefresher;

  private readonly parentId = computed(() => this.parent()?.id ?? null);
  private readonly kgId = computed(() => this.parent()?.kindergartenId ?? null);

  readonly myChildren = toSignal(
    toObservable(this.parentId).pipe(
      switchMap((pid) => (pid ? this.children.forParent(pid) : of<Child[]>([]))),
    ),
    { initialValue: [] as Child[] },
  );

  readonly kgDepartments = toSignal(
    toObservable(this.kgId).pipe(
      switchMap((id) =>
        id ? this.departments.forKindergarten(id) : of<Department[]>([]),
      ),
    ),
    { initialValue: [] as Department[] },
  );

  readonly allPosts = toSignal(
    toObservable(this.kgId).pipe(
      switchMap((id) => (id ? this.posts.forKindergarten(id) : of<Post[]>([]))),
    ),
    { initialValue: [] as Post[] },
  );

  readonly myDeptIds = computed(() =>
    Array.from(
      new Set(
        this.myChildren()
          .map((c) => c.departmentId)
          .filter((id): id is string => !!id),
      ),
    ),
  );

  readonly myDepartments = computed(() => {
    const ids = this.myDeptIds();
    return this.kgDepartments().filter((d) => ids.includes(d.id));
  });

  readonly filter = signal<string>('all');

  readonly visiblePosts = computed(() => {
    const all = this.allPosts();
    const myIds = this.myDeptIds();
    const f = this.filter();
    if (f === 'all') {
      return all.filter(
        (p) => p.departmentId === null || myIds.includes(p.departmentId),
      );
    }
    return all.filter((p) => p.departmentId === null || p.departmentId === f);
  });

  setFilter(event: CustomEvent): void {
    const value = event.detail.value;
    if (typeof value === 'string' && value) this.filter.set(value);
  }

  protected readonly funnelOutline = funnelOutline;

  departmentLabel(deptId: string | null): string {
    if (!deptId) return this.t.instant('admin.posts.allDepartments');
    const dept = this.kgDepartments().find((d) => d.id === deptId);
    return dept?.name ?? '';
  }

  protected readonly newspaperOutline = newspaperOutline;

  readonly loading = signal(true);
  protected readonly skeletonRows = [0, 1, 2];

  constructor() {
    effect(() => {
      if (this.allPosts().length > 0) this.loading.set(false);
    });
    setTimeout(() => this.loading.set(false), 1500);

    this.route.queryParamMap.subscribe((params) => {
      const id = params.get('focus');
      if (id) this.focusPost(id);
    });
  }

  async openPost(post: Post): Promise<void> {
    void this.parents.markPostSeen(post.id);
    const modal = await this.modalCtrl.create({
      component: PostViewModal,
      componentProps: {
        post,
        departmentName: post.departmentId
          ? this.kgDepartments().find((d) => d.id === post.departmentId)?.name ?? null
          : null,
      },
    });
    await modal.present();
  }

  private focusPost(id: string): void {
    this.flashingPostId.set(id);
    setTimeout(() => {
      const el = document.getElementById(`post-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    setTimeout(() => {
      if (this.flashingPostId() === id) this.flashingPostId.set(null);
    }, 1400);
  }
}

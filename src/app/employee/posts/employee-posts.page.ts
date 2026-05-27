import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  AlertController,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, newspaperOutline, trashOutline } from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '@app/auth/auth.service';
import { DateDmyPipe } from '@app/shared/pipes/date-dmy.pipe';
import { DepartmentsService } from '@app/data/departments.service';
import { NotificationsService } from '@app/data/notifications.service';
import { PostsService } from '@app/data/posts.service';
import { StaffService } from '@app/data/staff.service';
import { Department, Post } from '@app/data/types';
import { PostFormModal, PostFormResult } from '@app/admin/posts/post-form/post-form.modal';
import { PostDetailModal, PostUpdateResult } from '@app/admin/posts/post-detail/post-detail.modal';
import { PostViewModal } from '@app/shared/components/post-view/post-view.modal';
import { PostMediaPreviewComponent } from '@app/shared/components/post-media-preview/post-media-preview.component';
import { completeRefresher } from '@app/shared/utils/refresher';
import { SkeletonListComponent } from '@app/shared/components/skeleton-list/skeleton-list.component';

type PostDetailDismiss =
  | { action: 'update'; payload: PostUpdateResult }
  | { action: 'delete' };

@Component({
  selector: 'app-employee-posts',
  templateUrl: 'employee-posts.page.html',
  styleUrl: './employee-posts.page.scss',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonFab,
    IonFabButton,
    IonIcon,
    IonList,
    IonRefresher,
    IonRefresherContent,
    IonItem,
    IonItemSliding,
    IonItemOption,
    IonItemOptions,
    IonLabel,
    IonText,
    IonSegment,
    IonSegmentButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonSkeletonText,
    PostMediaPreviewComponent,
    TranslatePipe,
    DateDmyPipe,
    SkeletonListComponent,
  ],
})
export class EmployeePostsPage {
  private readonly t = inject(TranslateService);
  private readonly auth = inject(AuthService);
  private readonly alertCtrl = inject(AlertController);
  private readonly modalCtrl = inject(ModalController);
  private readonly route = inject(ActivatedRoute);
  readonly posts = inject(PostsService);
  readonly departments = inject(DepartmentsService);
  readonly staff = inject(StaffService);
  readonly notifications = inject(NotificationsService);

  readonly flashingPostId = signal<string | null>(null);

  protected readonly onRefresh = completeRefresher;

  readonly loading = signal(true);
  protected readonly skeletonRows = [0, 1, 2];

  constructor() {
    addIcons({
      'add-outline': addOutline,
      'newspaper-outline': newspaperOutline,
      'trash-outline': trashOutline,
    });
    effect(() => {
      if (this.posts.all().length > 0) this.loading.set(false);
    });
    setTimeout(() => this.loading.set(false), 1500);

    this.route.queryParamMap.subscribe((params) => {
      const id = params.get('focus');
      if (id) this.focusPost(id);
    });
  }

  private focusPost(id: string): void {
    this.flashingPostId.set(id);
    if (this.view() !== 'feed') this.view.set('feed');
    setTimeout(() => {
      const el = document.getElementById(`post-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    setTimeout(() => {
      if (this.flashingPostId() === id) this.flashingPostId.set(null);
    }, 1400);
  }

  readonly me = this.staff.currentStaff;

  readonly view = signal<'feed' | 'mine'>('feed');

  setView(event: CustomEvent): void {
    const value = event.detail.value;
    if (value === 'feed' || value === 'mine') this.view.set(value);
  }

  readonly myPosts = computed<Post[]>(() => {
    const uid = this.auth.currentUser()?.uid;
    return this.visiblePosts().filter((p) => p.authorUid === uid);
  });

  // Departments this employee can write to.
  readonly accessibleDepartments = computed<Department[]>(() => {
    const s = this.me();
    const all = this.departments.all();
    if (!s) return [];
    if (s.allDepartments) return all;
    return all.filter((d) => s.departmentIds.includes(d.id));
  });

  private readonly accessibleDeptIds = computed(
    () => new Set(this.accessibleDepartments().map((d) => d.id)),
  );

  // Posts the employee can see: those in their accessible departments OR broadcasts.
  readonly visiblePosts = computed<Post[]>(() => {
    const ids = this.accessibleDeptIds();
    const s = this.me();
    return this.posts
      .all()
      .filter(
        (p) =>
          p.departmentId === null ||
          (s?.allDepartments ?? false) ||
          ids.has(p.departmentId),
      );
  });

  departmentLabel(id: string | null): string {
    if (!id) return this.t.instant('admin.posts.allDepartments');
    return (
      this.departments.all().find((d) => d.id === id)?.name ??
      this.t.instant('admin.posts.allDepartments')
    );
  }

  canEdit(post: Post): boolean {
    return post.authorUid === this.auth.currentUser()?.uid;
  }

  async openCreate(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: PostFormModal,
      componentProps: { departments: this.accessibleDepartments() },
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<PostFormResult>();
    if (role === 'confirm' && data) {
      await this.posts.add({
        ...data,
        authorName: this.auth.currentUser()?.displayName ?? null,
      });
    }
  }

  async openView(post: Post): Promise<void> {
    void this.staff.markPostSeen(post.id);
    const modal = await this.modalCtrl.create({
      component: PostViewModal,
      componentProps: {
        post,
        departmentName: post.departmentId ? this.departmentLabel(post.departmentId) : null,
      },
    });
    await modal.present();
  }

  async openDetail(post: Post): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: PostDetailModal,
      componentProps: {
        post,
        departments: this.accessibleDepartments(),
        canEdit: this.canEdit(post),
      },
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<PostDetailDismiss>();
    if (role !== 'confirm' || !data) return;
    if (data.action === 'update') {
      await this.posts.update(post.id, data.payload);
    } else if (data.action === 'delete') {
      await this.posts.remove(post.id);
    }
  }

  async confirmDelete(post: Post): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.t.instant('common.confirmDeleteTitle'),
      message: this.t.instant('common.confirmDeleteMessage', { name: post.title }),
      buttons: [
        { text: this.t.instant('common.cancel'), role: 'cancel' },
        {
          text: this.t.instant('common.delete'),
          role: 'destructive',
          handler: () => {
            this.posts.remove(post.id);
          },
        },
      ],
    });
    await alert.present();
  }
}

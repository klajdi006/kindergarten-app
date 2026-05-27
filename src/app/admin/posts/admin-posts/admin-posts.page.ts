import { Component, computed, effect, inject, signal } from '@angular/core';
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
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, newspaperOutline, trashOutline } from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '@app/auth/auth.service';
import { DateDmyPipe } from '@app/shared/pipes/date-dmy.pipe';
import { DepartmentsService } from '@app/data/departments.service';
import { PostsService } from '@app/data/posts.service';
import { Post } from '@app/data/types';
import { PostFormModal, PostFormResult } from '@app/admin/posts/post-form/post-form.modal';
import { PostDetailModal, PostUpdateResult } from '@app/admin/posts/post-detail/post-detail.modal';
import { completeRefresher } from '@app/shared/utils/refresher';
import { SkeletonListComponent } from '@app/shared/components/skeleton-list/skeleton-list.component';

type PostDetailDismiss =
  | { action: 'update'; payload: PostUpdateResult }
  | { action: 'delete' };

@Component({
  selector: 'app-admin-posts',
  templateUrl: 'admin-posts.page.html',
  styleUrl: './admin-posts.page.scss',
  host: { style: 'display: contents' },
  imports: [
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonFab,
    IonFabButton,
    IonIcon,
    IonList,
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
    TranslatePipe,
    DateDmyPipe,
    SkeletonListComponent,
  ],
})
export class AdminPostsPage {
  private readonly t = inject(TranslateService);
  private readonly auth = inject(AuthService);
  private readonly alertCtrl = inject(AlertController);
  private readonly modalCtrl = inject(ModalController);
  readonly posts = inject(PostsService);
  readonly departments = inject(DepartmentsService);

  readonly view = signal<'feed' | 'mine'>('feed');

  readonly myPosts = computed(() => {
    const uid = this.auth.currentUser()?.uid;
    return this.posts.all().filter((p) => p.authorUid === uid);
  });

  setView(event: CustomEvent): void {
    const value = event.detail.value;
    if (value === 'feed' || value === 'mine') this.view.set(value);
  }

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
  }

  departmentLabel(id: string | null): string {
    if (!id) return this.t.instant('admin.posts.allDepartments');
    return (
      this.departments.all().find((d) => d.id === id)?.name ??
      this.t.instant('admin.posts.allDepartments')
    );
  }

  async openCreate(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: PostFormModal,
      componentProps: { departments: this.departments.all() },
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

  canEdit(post: Post): boolean {
    return post.authorUid === this.auth.currentUser()?.uid;
  }

  async openDetail(post: Post): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: PostDetailModal,
      componentProps: {
        post,
        departments: this.departments.all(),
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

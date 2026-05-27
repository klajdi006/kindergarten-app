import { Component, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  IonContent,
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
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { imagesOutline } from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { of, switchMap } from 'rxjs';
import { AlbumsService } from '@app/data/albums.service';
import { ChildrenService } from '@app/data/children.service';
import { DepartmentsService } from '@app/data/departments.service';
import { ParentsService } from '@app/data/parents.service';
import { Album, Child } from '@app/data/types';
import { completeRefresher } from '@app/shared/utils/refresher';
import { SkeletonListComponent } from '@app/shared/components/skeleton-list/skeleton-list.component';

@Component({
  selector: 'app-parent-albums',
  templateUrl: 'parent-albums.page.html',
  styleUrl: './parent-albums.page.scss',
  imports: [
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonText,
    TranslatePipe,
    SkeletonListComponent,
  ],
})
export class ParentAlbumsPage {
  private readonly t = inject(TranslateService);
  private readonly parents = inject(ParentsService);
  private readonly children = inject(ChildrenService);
  readonly albums = inject(AlbumsService);
  readonly departments = inject(DepartmentsService);

  private readonly myChildren = toSignal(
    toObservable(this.parents.currentParent).pipe(
      switchMap((p) => (p ? this.children.forParent(p.id) : of<Child[]>([]))),
    ),
    { initialValue: [] as Child[] },
  );

  private readonly myDeptIds = computed(
    () => new Set(
      this.myChildren()
        .map((c) => c.departmentId)
        .filter((id): id is string => !!id),
    ),
  );

  readonly visibleAlbums = computed<Album[]>(() => {
    const ids = this.myDeptIds();
    return this.albums.all().filter((a) => ids.has(a.departmentId));
  });

  readonly departmentsById = computed(() => {
    const map = new Map<string, string>();
    for (const d of this.departments.all()) map.set(d.id, d.name);
    return map;
  });

  departmentName(id: string): string {
    return this.departmentsById().get(id) ?? this.t.instant('admin.children.unassigned');
  }

  protected readonly onRefresh = completeRefresher;

  readonly loading = signal(true);

  constructor() {
    addIcons({ 'images-outline': imagesOutline });
    effect(() => {
      if (this.albums.all().length > 0) this.loading.set(false);
    });
    setTimeout(() => this.loading.set(false), 1500);
  }
}

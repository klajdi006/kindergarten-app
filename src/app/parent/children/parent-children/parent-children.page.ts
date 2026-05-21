import { Component, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  IonCard,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonRefresher,
  IonRefresherContent,
  IonText,
  IonToggle,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { bandageOutline, happyOutline } from 'ionicons/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { TabHeaderComponent } from '@app/shared/components/tab-header/tab-header.component';
import { AbsencesService } from '@app/data/absences.service';
import { ChildrenService } from '@app/data/children.service';
import { DepartmentsService } from '@app/data/departments.service';
import { ParentsService } from '@app/data/parents.service';
import { Absence, Child, Department } from '@app/data/types';
import { completeRefresher } from '@app/shared/utils/refresher';
import { SkeletonListComponent } from '@app/shared/components/skeleton-list/skeleton-list.component';

@Component({
  selector: 'app-parent-children',
  templateUrl: 'parent-children.page.html',
  imports: [
    RouterLink,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonCard,
    IonItem,
    IonLabel,
    IonIcon,
    IonToggle,
    IonText,
    TabHeaderComponent,
    TranslatePipe,
    SkeletonListComponent,
  ],
})
export class ParentChildrenPage {
  private readonly parents = inject(ParentsService);
  private readonly children = inject(ChildrenService);
  private readonly departments = inject(DepartmentsService);
  private readonly absences = inject(AbsencesService);

  readonly parent = this.parents.currentParent;
  private readonly kgId = computed(() => this.parent()?.kindergartenId ?? null);

  protected readonly onRefresh = completeRefresher;

  readonly myChildren = toSignal(
    toObservable(computed(() => this.parent()?.id ?? null)).pipe(
      switchMap((pid) => (pid ? this.children.forParent(pid) : of<Child[]>([]))),
    ),
    { initialValue: [] as Child[] },
  );

  private readonly kgDepartments = toSignal(
    toObservable(this.kgId).pipe(
      switchMap((id) => (id ? this.departments.forKindergarten(id) : of<Department[]>([]))),
    ),
    { initialValue: [] as Department[] },
  );

  private readonly absencesByChild = toSignal(
    toObservable(this.myChildren).pipe(
      switchMap((children) => {
        if (children.length === 0) return of<Record<string, Absence[]>>({});
        return combineLatest(
          children.map((c) =>
            this.absences.forChild(c.id).pipe(map((abs) => [c.id, abs] as const)),
          ),
        ).pipe(
          map((pairs) => {
            const acc: Record<string, Absence[]> = {};
            for (const [id, abs] of pairs) acc[id] = abs;
            return acc;
          }),
        );
      }),
    ),
    { initialValue: {} as Record<string, Absence[]> },
  );

  readonly todayStr = computed(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  departmentName(child: Child): string | null {
    if (!child.departmentId) return null;
    return this.kgDepartments().find((d) => d.id === child.departmentId)?.name ?? null;
  }

  isSickToday(childId: string): boolean {
    const today = this.todayStr();
    const abs = this.absencesByChild()[childId] ?? [];
    return abs.some((a) => a.type === 'sick' && a.startDate <= today && a.endDate >= today);
  }

  async toggleSickToday(child: Child, event: CustomEvent): Promise<void> {
    const checked = !!(event.detail as { checked?: boolean }).checked;
    const today = this.todayStr();
    const abs = this.absencesByChild()[child.id] ?? [];
    const existing = abs.find(
      (a) => a.type === 'sick' && a.startDate <= today && a.endDate >= today,
    );

    if (checked && !existing) {
      await this.absences.add({
        childId: child.id,
        kindergartenId: child.kindergartenId,
        type: 'sick',
        startDate: today,
        endDate: today,
        note: '',
      });
      return;
    }
    if (!checked && existing) {
      await this.absences.remove(existing.id);
    }
  }

  protected readonly bandageOutline = bandageOutline;
  protected readonly happyOutline = happyOutline;

  readonly loading = signal(true);

  constructor() {
    addIcons({ 'bandage-outline': bandageOutline, 'happy-outline': happyOutline });
    effect(() => {
      if (this.myChildren().length > 0) this.loading.set(false);
    });
    setTimeout(() => this.loading.set(false), 1500);
  }
}

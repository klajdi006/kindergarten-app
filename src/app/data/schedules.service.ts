import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import { Firestore, doc, docData, setDoc } from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { WeeklySchedule } from '@app/data/schedule';

@Injectable({ providedIn: 'root' })
export class SchedulesService {
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(Injector);

  forChild(childId: string): Observable<WeeklySchedule | null> {
    return runInInjectionContext(this.injector, () => {
      const ref = doc(this.firestore, 'children', childId, 'schedule', 'weekly');
      return (docData(ref) as Observable<WeeklySchedule | undefined>).pipe(
        map((data) => data ?? null),
      );
    });
  }

  async update(childId: string, schedule: WeeklySchedule): Promise<void> {
    const ref = doc(this.firestore, 'children', childId, 'schedule', 'weekly');
    await setDoc(ref, schedule);
  }
}

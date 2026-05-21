import { Injectable, inject } from '@angular/core';
import { Firestore, doc, docData, setDoc } from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { WeeklySchedule } from '@app/data/schedule';

@Injectable({ providedIn: 'root' })
export class SchedulesService {
  private readonly firestore = inject(Firestore);

  forChild(childId: string): Observable<WeeklySchedule | null> {
    const ref = doc(this.firestore, 'children', childId, 'schedule', 'weekly');
    return (docData(ref) as Observable<WeeklySchedule | undefined>).pipe(
      map((data) => data ?? null),
    );
  }

  async update(childId: string, schedule: WeeklySchedule): Promise<void> {
    const ref = doc(this.firestore, 'children', childId, 'schedule', 'weekly');
    await setDoc(ref, schedule);
  }
}

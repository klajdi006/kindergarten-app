import { Injectable, inject } from '@angular/core';
import { Firestore, doc, docData, setDoc } from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { AuthService } from '@app/auth/auth.service';
import { ChildHealth } from '@app/data/types';

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  forChild(childId: string): Observable<ChildHealth | null> {
    const ref = doc(this.firestore, 'children', childId, 'health', 'profile');
    return (docData(ref) as Observable<ChildHealth | undefined>).pipe(
      map((data) => data ?? null),
    );
  }

  async save(childId: string, profile: Omit<ChildHealth, 'updatedAt' | 'updatedByUid'>): Promise<void> {
    const uid = this.auth.currentUser()?.uid;
    if (!uid) throw new Error('Not authenticated');
    const ref = doc(this.firestore, 'children', childId, 'health', 'profile');
    await setDoc(ref, { ...profile, updatedAt: Date.now(), updatedByUid: uid });
  }
}

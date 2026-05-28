import { Injectable, Injector, computed, inject, runInInjectionContext } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  Firestore,
  doc,
  docData,
  updateDoc,
} from '@angular/fire/firestore';
import { Observable, of, switchMap } from 'rxjs';
import { AuthService } from '@app/auth/auth.service';
import { OperatingHours } from '@app/data/schedule';
import { Kindergarten } from '@app/data/types';

@Injectable({ providedIn: 'root' })
export class KindergartensService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);

  private readonly kgId = computed(() => this.auth.kindergartenId());

  readonly current = toSignal(
    toObservable(this.kgId).pipe(
      switchMap((id) => {
        if (!id) return of<Kindergarten | null>(null);
        return runInInjectionContext(this.injector, () =>
          (
            docData(doc(this.firestore, 'kindergartens', id), { idField: 'id' }) as Observable<
              Kindergarten | undefined
            >
          ).pipe(switchMap((d) => of(d ?? null))),
        );
      }),
    ),
    { initialValue: null as Kindergarten | null },
  );

  async update(input: { name: string; address: string | null }): Promise<void> {
    const id = this.kgId();
    if (!id) throw new Error('No kindergarten');
    await updateDoc(doc(this.firestore, 'kindergartens', id), {
      name: input.name.trim(),
      address: input.address?.trim() || null,
    });
  }

  async updateOperatingHours(operatingHours: OperatingHours): Promise<void> {
    const id = this.kgId();
    if (!id) throw new Error('No kindergarten');
    await updateDoc(doc(this.firestore, 'kindergartens', id), { operatingHours });
  }
}

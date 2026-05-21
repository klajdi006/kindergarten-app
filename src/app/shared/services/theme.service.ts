import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemePreference = 'system' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'kg.theme';
const DARK_CLASS = 'ion-palette-dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  private readonly mediaQuery = this.doc.defaultView?.matchMedia('(prefers-color-scheme: dark)');

  private readonly systemDark = signal<boolean>(this.mediaQuery?.matches ?? false);
  readonly preference = signal<ThemePreference>(this.readStoredPreference());

  readonly resolved = computed<ResolvedTheme>(() => {
    const pref = this.preference();
    if (pref === 'system') return this.systemDark() ? 'dark' : 'light';
    return pref;
  });

  constructor() {
    this.mediaQuery?.addEventListener('change', (e) => this.systemDark.set(e.matches));

    effect(() => {
      const html = this.doc.documentElement;
      html.classList.toggle(DARK_CLASS, this.resolved() === 'dark');
    });

    effect(() => {
      try {
        this.doc.defaultView?.localStorage?.setItem(STORAGE_KEY, this.preference());
      } catch {
        // Storage may be unavailable (private mode, SSR) — preference stays in-memory only
      }
    });
  }

  setPreference(pref: ThemePreference): void {
    this.preference.set(pref);
  }

  cycle(): void {
    const order: ThemePreference[] = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(this.preference()) + 1) % order.length];
    this.setPreference(next);
  }

  private readStoredPreference(): ThemePreference {
    try {
      const v = this.doc.defaultView?.localStorage?.getItem(STORAGE_KEY);
      if (v === 'light' || v === 'dark' || v === 'system') return v;
    } catch {
      // ignore
    }
    return 'system';
  }
}

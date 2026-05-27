import { Injectable } from '@angular/core';

/**
 * Local persistence keys used across the app. Keep in sync with the keys
 * referenced directly in ThemeService ('kg.theme') and LanguageService
 * ('kg.lang').
 */
export const STORAGE_KEYS = {
  language: 'kg.lang',
  theme: 'kg.theme',
  pushDeviceId: 'kg.push.deviceId',
} as const;

/** Keys that survive a logout wipe — user UI preferences, not session data. */
const PRESERVED_ON_LOGOUT: readonly string[] = [STORAGE_KEYS.language, STORAGE_KEYS.theme];

@Injectable({ providedIn: 'root' })
export class StorageService {
  private get ls(): Storage | null {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
      return null;
    }
  }

  get(key: string): string | null {
    return this.ls?.getItem(key) ?? null;
  }

  set(key: string, value: string): void {
    try {
      this.ls?.setItem(key, value);
    } catch {
      // Storage unavailable (private mode, quota) — value stays in-memory only.
    }
  }

  remove(key: string): void {
    try {
      this.ls?.removeItem(key);
    } catch {
      // ignore
    }
  }

  /**
   * Wipe all client-side persistence on logout EXCEPT the user's UI
   * preferences (language + theme): localStorage, sessionStorage, and any
   * JS-accessible cookies. Firebase auth state lives in IndexedDB and is
   * cleared by signOut() itself.
   */
  clearExceptPreferences(): void {
    const ls = this.ls;
    if (ls) {
      const preserved: Record<string, string> = {};
      for (const key of PRESERVED_ON_LOGOUT) {
        const v = ls.getItem(key);
        if (v !== null) preserved[key] = v;
      }
      ls.clear();
      for (const [k, v] of Object.entries(preserved)) ls.setItem(k, v);
    }

    try {
      sessionStorage.clear();
    } catch {
      // ignore
    }

    this.clearCookies();
  }

  private clearCookies(): void {
    if (typeof document === 'undefined' || !document.cookie) return;
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const name = cookie.split('=')[0]?.trim();
      if (!name) continue;
      // Expire on the current path and root path.
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
  }
}

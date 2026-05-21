import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type LanguageCode = 'en' | 'al';

interface LanguageOption {
  code: LanguageCode;
  label: string;
  short: string;
}

const STORAGE_KEY = 'kg.lang';
const FALLBACK: LanguageCode = 'en';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly doc = inject(DOCUMENT);

  readonly options: ReadonlyArray<LanguageOption> = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'al', label: 'Shqip', short: 'AL' },
  ];

  readonly current = signal<LanguageCode>(FALLBACK);
  readonly currentOption = computed<LanguageOption>(
    () => this.options.find((o) => o.code === this.current()) ?? this.options[0],
  );

  constructor() {
    this.translate.addLangs(this.options.map((o) => o.code));
    this.translate.setFallbackLang(FALLBACK);

    const initial = this.readStored() ?? FALLBACK;
    this.use(initial);
  }

  use(code: LanguageCode): void {
    this.current.set(code);
    this.translate.use(code);
    this.doc.documentElement.setAttribute('lang', code);
    try {
      this.doc.defaultView?.localStorage?.setItem(STORAGE_KEY, code);
    } catch {
      // ignore
    }
  }

  toggle(): void {
    this.use(this.current() === 'en' ? 'al' : 'en');
  }

  private readStored(): LanguageCode | null {
    try {
      const v = this.doc.defaultView?.localStorage?.getItem(STORAGE_KEY);
      if (v === 'en' || v === 'al') return v;
    } catch {
      // ignore
    }
    return null;
  }
}

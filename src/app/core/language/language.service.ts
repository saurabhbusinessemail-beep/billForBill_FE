import { Injectable, signal } from '@angular/core';

export type AppLanguage = 'en' | 'hi';

const LANGUAGE_STORAGE_KEY = 'billforbill.language';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private hasSavedLanguagePreference = false;
  readonly currentLanguage = signal<AppLanguage>('en');
  readonly ready = signal(false);

  constructor() {
    const savedLanguage = this.readSavedLanguage();
    this.hasSavedLanguagePreference = savedLanguage !== null;
    this.currentLanguage.set(savedLanguage ?? 'en');
    this.ready.set(savedLanguage !== null);
  }

  setDetectedCountry(countryCode?: string): void {
    if (!this.hasSavedLanguagePreference) this.currentLanguage.set(countryCode === 'IN' ? 'hi' : 'en');
    this.ready.set(true);
  }

  setLanguage(language: string): void {
    if (language !== 'en' && language !== 'hi') return;
    if (language === this.currentLanguage()) return;
    this.currentLanguage.set(language);
    this.hasSavedLanguagePreference = true;
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Keep the selected language active for this visit if storage is unavailable.
    }
    window.location.reload();
  }

  private readSavedLanguage(): AppLanguage | null {
    try {
      const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      return savedLanguage === 'en' || savedLanguage === 'hi' ? savedLanguage : null;
    } catch {
      return null;
    }
  }
}

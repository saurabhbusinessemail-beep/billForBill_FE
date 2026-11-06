import { inject, Pipe, PipeTransform } from '@angular/core';
import { LanguageService, AppLanguage } from '../../core/language/language.service';
import en from './locales/en';
import hi from './locales/hi';

type TranslationKey = keyof typeof en;
type TranslationParams = Record<string, string | number>;
const TRANSLATIONS: Record<AppLanguage, Record<string, string>> = {
  en: en as Record<TranslationKey, string>,
  hi: hi as Record<TranslationKey, string>,
};

@Pipe({ name: 'translate', pure: true, standalone: false })
export class TranslatePipe implements PipeTransform {
  private readonly languageService = inject(LanguageService);

  transform(key: string, params?: TranslationParams): string {
    const language = this.languageService.currentLanguage();
    let translation = TRANSLATIONS[language]?.[key] ?? TRANSLATIONS.en[key] ?? '';
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        translation = translation.replaceAll(`{${name}}`, String(value));
      }
    }
    return translation;
  }
}

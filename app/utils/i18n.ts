export type TextDirection = 'ltr' | 'rtl'

export interface LocaleMeta {
  code: string
  name: string
  englishName: string
  dir: TextDirection
}

export const LOCALES: LocaleMeta[] = [
  { code: 'en', name: 'English', englishName: 'English', dir: 'ltr' },
  { code: 'ar', name: 'العربية', englishName: 'Arabic', dir: 'rtl' },
  { code: 'ckb', name: 'کوردیی ناوەندی', englishName: 'Central Kurdish', dir: 'rtl' },
  { code: 'da', name: 'Dansk', englishName: 'Danish', dir: 'ltr' },
  { code: 'de', name: 'Deutsch', englishName: 'German', dir: 'ltr' },
  { code: 'el', name: 'Ελληνικά', englishName: 'Greek', dir: 'ltr' },
  { code: 'es', name: 'Español', englishName: 'Spanish', dir: 'ltr' },
  { code: 'fa', name: 'فارسی', englishName: 'Persian', dir: 'rtl' },
  { code: 'fr', name: 'Français', englishName: 'French', dir: 'ltr' },
  { code: 'he', name: 'עברית', englishName: 'Hebrew', dir: 'rtl' },
  { code: 'hi', name: 'हिन्दी', englishName: 'Hindi', dir: 'ltr' },
  { code: 'id', name: 'Bahasa Indonesia', englishName: 'Indonesian', dir: 'ltr' },
  { code: 'it', name: 'Italiano', englishName: 'Italian', dir: 'ltr' },
  { code: 'ja', name: '日本語', englishName: 'Japanese', dir: 'ltr' },
  { code: 'ko', name: '한국어', englishName: 'Korean', dir: 'ltr' },
  { code: 'nl', name: 'Nederlands', englishName: 'Dutch', dir: 'ltr' },
  { code: 'no', name: 'Norsk', englishName: 'Norwegian', dir: 'ltr' },
  { code: 'pl', name: 'Polski', englishName: 'Polish', dir: 'ltr' },
  { code: 'pt', name: 'Português', englishName: 'Portuguese', dir: 'ltr' },
  { code: 'ru', name: 'Русский', englishName: 'Russian', dir: 'ltr' },
  { code: 'sv', name: 'Svenska', englishName: 'Swedish', dir: 'ltr' },
  { code: 'tr', name: 'Türkçe', englishName: 'Turkish', dir: 'ltr' },
  { code: 'uk', name: 'Українська', englishName: 'Ukrainian', dir: 'ltr' },
  { code: 'vi', name: 'Tiếng Việt', englishName: 'Vietnamese', dir: 'ltr' },
  { code: 'zh', name: '中文', englishName: 'Chinese', dir: 'ltr' },
]

export const DEFAULT_LOCALE = 'en'

export const LOCALE_COOKIE = 'opendeck-locale'

export function isSupportedLocale(code: string | null | undefined): code is string {
  return Boolean(code) && LOCALES.some((l) => l.code === code)
}

export function localeDir(code: string): TextDirection {
  return LOCALES.find((l) => l.code === code)?.dir ?? 'ltr'
}

let composer: { locale: { value: string } } | null = null

export function bindI18n(instance: { locale: { value: string } }) {
  composer = instance
}

export function applyLocaleGlobally(code: string) {
  if (!isSupportedLocale(code)) return
  if (composer) composer.locale.value = code
  if (import.meta.client) {
    try {
      document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=31536000; samesite=lax`
    } catch {}
  }
}

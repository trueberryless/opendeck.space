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
  { code: 'bg', name: 'Български', englishName: 'Bulgarian', dir: 'ltr' },
  { code: 'bn', name: 'বাংলা', englishName: 'Bengali', dir: 'ltr' },
  { code: 'ca', name: 'Català', englishName: 'Catalan', dir: 'ltr' },
  { code: 'ckb', name: 'کوردیی ناوەندی', englishName: 'Central Kurdish', dir: 'rtl' },
  { code: 'cs', name: 'Čeština', englishName: 'Czech', dir: 'ltr' },
  { code: 'da', name: 'Dansk', englishName: 'Danish', dir: 'ltr' },
  { code: 'de', name: 'Deutsch', englishName: 'German', dir: 'ltr' },
  { code: 'el', name: 'Ελληνικά', englishName: 'Greek', dir: 'ltr' },
  { code: 'es', name: 'Español', englishName: 'Spanish', dir: 'ltr' },
  { code: 'fa', name: 'فارسی', englishName: 'Persian', dir: 'rtl' },
  { code: 'fi', name: 'Suomi', englishName: 'Finnish', dir: 'ltr' },
  { code: 'fr', name: 'Français', englishName: 'French', dir: 'ltr' },
  { code: 'he', name: 'עברית', englishName: 'Hebrew', dir: 'rtl' },
  { code: 'hi', name: 'हिन्दी', englishName: 'Hindi', dir: 'ltr' },
  { code: 'hr', name: 'Hrvatski', englishName: 'Croatian', dir: 'ltr' },
  { code: 'hu', name: 'Magyar', englishName: 'Hungarian', dir: 'ltr' },
  { code: 'id', name: 'Bahasa Indonesia', englishName: 'Indonesian', dir: 'ltr' },
  { code: 'it', name: 'Italiano', englishName: 'Italian', dir: 'ltr' },
  { code: 'ja', name: '日本語', englishName: 'Japanese', dir: 'ltr' },
  { code: 'ko', name: '한국어', englishName: 'Korean', dir: 'ltr' },
  { code: 'ms', name: 'Bahasa Melayu', englishName: 'Malay', dir: 'ltr' },
  { code: 'nl', name: 'Nederlands', englishName: 'Dutch', dir: 'ltr' },
  { code: 'no', name: 'Norsk', englishName: 'Norwegian', dir: 'ltr' },
  { code: 'pl', name: 'Polski', englishName: 'Polish', dir: 'ltr' },
  { code: 'pt', name: 'Português', englishName: 'Portuguese', dir: 'ltr' },
  { code: 'ro', name: 'Română', englishName: 'Romanian', dir: 'ltr' },
  { code: 'ru', name: 'Русский', englishName: 'Russian', dir: 'ltr' },
  { code: 'sk', name: 'Slovenčina', englishName: 'Slovak', dir: 'ltr' },
  { code: 'sr', name: 'Српски', englishName: 'Serbian', dir: 'ltr' },
  { code: 'sv', name: 'Svenska', englishName: 'Swedish', dir: 'ltr' },
  { code: 'sw', name: 'Kiswahili', englishName: 'Swahili', dir: 'ltr' },
  { code: 'th', name: 'ไทย', englishName: 'Thai', dir: 'ltr' },
  { code: 'tl', name: 'Filipino', englishName: 'Filipino', dir: 'ltr' },
  { code: 'tr', name: 'Türkçe', englishName: 'Turkish', dir: 'ltr' },
  { code: 'uk', name: 'Українська', englishName: 'Ukrainian', dir: 'ltr' },
  { code: 'ur', name: 'اردو', englishName: 'Urdu', dir: 'rtl' },
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
let loadMessages: (code: string) => Promise<void> = () => Promise.resolve()

export function bindI18n(instance: { locale: { value: string } }, loader: (code: string) => Promise<void>) {
  composer = instance
  loadMessages = loader
}

export async function switchLocale(code: string): Promise<void> {
  if (!isSupportedLocale(code)) return
  await loadMessages(code)
  if (composer) composer.locale.value = code
}

export async function applyLocaleGlobally(code: string) {
  if (!isSupportedLocale(code)) return
  await switchLocale(code)
  if (import.meta.client) {
    try {
      document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=31536000; samesite=lax`
    } catch {}
  }
}

export function langAttr(code: string | null | undefined): string | undefined {
  const value = code?.trim()
  if (!value || !/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(value)) return undefined
  try {
    return Intl.getCanonicalLocales(value)[0]
  } catch {
    return undefined
  }
}

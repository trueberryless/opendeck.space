export type TextDirection = 'ltr' | 'rtl'

export interface LocaleMeta {
  code: string
  name: string
  englishName: string
  dir: TextDirection
}

export const LOCALES: LocaleMeta[] = [
  { code: 'en', name: 'English', englishName: 'English', dir: 'ltr' },
  { code: 'de', name: 'Deutsch', englishName: 'German', dir: 'ltr' },
]

export const DEFAULT_LOCALE = 'en'

export const LOCALE_COOKIE = 'opendeck-locale'

export function isSupportedLocale(code: string | null | undefined): code is string {
  return Boolean(code) && LOCALES.some((l) => l.code === code)
}

export function localeDir(code: string): TextDirection {
  return LOCALES.find((l) => l.code === code)?.dir ?? 'ltr'
}

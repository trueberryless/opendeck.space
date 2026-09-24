import {
  parseVerificationPath,
  REVIEW_PATH,
  SOURCE_LANGUAGE,
  type TranslationVerification,
} from '~~/shared/translations'

export const TRANSLATION_NOTICE_KEY = 'opendeck-translation-notice-dismissed'

const verificationFiles = import.meta.glob<TranslationVerification[]>('../data/verifications/**/*.json', {
  eager: true,
  import: 'default',
})

const verifications = new Map<string, TranslationVerification[]>()
for (const [path, list] of Object.entries(verificationFiles)) {
  const file = parseVerificationPath(path)
  if (file) verifications.set(`${file.scope}/${file.language}`, list)
}

export function uiVerifications(locale: string): TranslationVerification[] {
  return verifications.get(`ui/${locale}`) ?? []
}

export function packVerifications(pack: string, locale: string): TranslationVerification[] {
  return verifications.get(`${pack}/${locale}`) ?? []
}

export function isOriginalLanguage(locale: string): boolean {
  return locale === SOURCE_LANGUAGE
}

export function isUiChecked(locale: string): boolean {
  return isOriginalLanguage(locale) || uiVerifications(locale).length > 0
}

export function isPackChecked(pack: { id: string }, locale: string): boolean {
  return isOriginalLanguage(locale) || packVerifications(pack.id, locale).length > 0
}

/** A pack is verified once a native or fluent speaker has checked every language it is available in. */
export function isPackVerified(pack: { id: string; languages: string[] }): boolean {
  return pack.languages.every((code) => isPackChecked(pack, code))
}

export function reviewRoute(locale?: string, pack?: string) {
  return { path: REVIEW_PATH, query: { ...(locale ? { lang: locale } : {}), ...(pack ? { file: pack } : {}) } }
}

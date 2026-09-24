import status from 'virtual:translation-status'
import {
  REVIEW_PATH,
  SOURCE_LANGUAGE,
  type Fluency,
  type TranslationCheck,
  type TranslationFileStatus,
} from '~~/shared/translations'

export const TRANSLATION_NOTICE_KEY = 'opendeck-translation-notice-dismissed'

export interface TranslationCredit {
  github: string
  name?: string
  languages: { code: string; fluency: Fluency; scopes: string[] }[]
  files: number
  since: string
}

export function translationCredits(): TranslationCredit[] {
  const people = new Map<string, TranslationCredit>()
  for (const [key, file] of Object.entries(status)) {
    const [scope = '', code = ''] = key.split('/')
    for (const check of file.checks) {
      const person = people.get(check.github) ?? { github: check.github, languages: [], files: 0, since: check.date }
      if (check.name) person.name = check.name
      if (check.date < person.since) person.since = check.date
      let language = person.languages.find((l) => l.code === code)
      if (!language) person.languages.push((language = { code, fluency: check.fluency, scopes: [] }))
      if (check.fluency === 'native') language.fluency = 'native'
      language.scopes.push(scope)
      person.files++
      people.set(check.github, person)
    }
  }
  for (const person of people.values()) {
    for (const language of person.languages) {
      language.scopes.sort((a, b) => (a === 'ui' ? -1 : b === 'ui' ? 1 : a.localeCompare(b)))
    }
  }
  return [...people.values()].sort((a, b) => b.files - a.files || a.since.localeCompare(b.since))
}

export function translationFileStatus(scope: string, locale: string): TranslationFileStatus | undefined {
  return status[`${scope}/${locale}`]
}

export function uiVerifications(locale: string): TranslationCheck[] {
  return translationFileStatus('ui', locale)?.checks ?? []
}

export function packVerifications(pack: string, locale: string): TranslationCheck[] {
  return translationFileStatus(pack, locale)?.checks ?? []
}

export function pendingStrings(scope: string, locale: string): number {
  const file = translationFileStatus(scope, locale)
  return file?.checks.length ? file.pending : 0
}

export function isOriginalLanguage(locale: string): boolean {
  return locale === SOURCE_LANGUAGE
}

function isFileChecked(scope: string, locale: string): boolean {
  const file = translationFileStatus(scope, locale)
  return isOriginalLanguage(locale) || Boolean(file?.checks.length && file.pending === 0)
}

export function isUiChecked(locale: string): boolean {
  return isFileChecked('ui', locale)
}

export function isPackChecked(pack: { id: string }, locale: string): boolean {
  return isFileChecked(pack.id, locale)
}

export function isPackVerified(pack: { id: string; languages: string[] }): boolean {
  return pack.languages.every((code) => isPackChecked(pack, code))
}

export function reviewRoute(locale?: string, pack?: string) {
  return { path: REVIEW_PATH, query: { ...(locale ? { lang: locale } : {}), ...(pack ? { file: pack } : {}) } }
}

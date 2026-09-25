export const REPO = 'trueberryless/opendeck.space'
export const REPO_URL = `https://github.com/${REPO}`
export const SITE_URL = 'https://opendeck.space'
export const DASHBOARD_URL = 'https://i18n.opendeck.space'
export const REVIEW_PATH = '/translations/review'
export const SOURCE_LANGUAGE = 'en'

export const CHECK_TEMPLATE = '2_translation_check.yaml'
export const FIX_TEMPLATE = '3_translation_fix.yaml'

export const REVIEW_FIELD = 'review'
export const REVIEW_HEADING = 'Review'
export const CONFIRM_HEADING = 'Confirmation'
export const MAX_ISSUE_URL_LENGTH = 7500
export const MAX_CHANGES = 500
export const MAX_STRING_LENGTH = 2000

export type Fluency = 'native' | 'fluent'

export interface TranslationVerification {
  github: string
  did?: string
  name?: string
  fluency: Fluency
  date: string
  commit: string
  issue: number
  strings: Record<string, string>
}

export type TranslationCheck = Omit<TranslationVerification, 'strings'>

export interface TranslationFileStatus {
  checks: TranslationCheck[]
  pending: number
  total: number
}

export interface TranslationReview {
  language: string
  scope: string
  commit: string
  fluency?: Fluency
  keys?: string[]
  changes: Record<string, string>
}

export const VERIFICATIONS_DIR = 'app/data/verifications'

export function verificationPath(scope: string, language: string): string {
  return scope === 'ui'
    ? `${VERIFICATIONS_DIR}/ui/${language}.json`
    : `${VERIFICATIONS_DIR}/packs/${scope}/${language}.json`
}

export function parseVerificationPath(path: string): { scope: string; language: string } | undefined {
  const match = /(?:^|\/)(?:ui|packs\/([^/]+))\/([^/]+)\.json$/.exec(path)
  return match ? { scope: match[1] ?? 'ui', language: match[2]! } : undefined
}

export function englishLanguageName(
  code: string,
  locales: readonly { code: string; englishName: string }[],
  languageNames: Record<string, string>,
): string {
  return locales.find((l) => l.code === code)?.englishName ?? languageNames[code] ?? code
}

export function filePath(scope: string, language: string): string {
  return scope === 'ui' ? `i18n/${language}.json` : `app/data/starter-packs/${scope}/${language}.json`
}

export function reviewUrl(language?: string, scope?: string): string {
  const params = new URLSearchParams()
  if (language) params.set('lang', language)
  if (scope) params.set('file', scope)
  const query = params.toString()
  return `${SITE_URL}${REVIEW_PATH}${query ? `?${query}` : ''}`
}

export function issueUrl(template: string, fields: Record<string, string | undefined> = {}): string {
  const query = Object.entries({ template, ...fields })
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  return `${REPO_URL}/issues/new?${query}`
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

function flatten(value: Json, prefix: string, out: Map<string, string>): Map<string, string> {
  if (typeof value === 'string') out.set(prefix, value)
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) flatten(child, prefix ? `${prefix}.${key}` : key, out)
  }
  return out
}

export function translatableStrings(scope: string, data: unknown): Map<string, string> {
  const map = new Map<string, string>()
  if (scope === 'ui') return flatten(data as Json, '', map)
  return flatten((data as { entries?: Json }).entries ?? {}, 'entries', map)
}

export function sourceText(english: Map<string, string>, key: string): string | undefined {
  return english.get(key) ?? (key.endsWith('.reading') ? english.get(key.replace(/\.reading$/, '.text')) : undefined)
}

export interface ReviewableString {
  source: string
  value: string
}

export function reviewableStrings(
  english: Map<string, string>,
  target: Map<string, string>,
): Map<string, ReviewableString> {
  const strings = new Map<string, ReviewableString>()
  for (const [key, value] of target) {
    const source = sourceText(english, key)
    if (source !== undefined) strings.set(key, { source, value })
  }
  return strings
}

export function stringFingerprint({ source, value }: ReviewableString): string {
  let hash = 0x811c9dc5
  for (const char of `${source}\u0000${value}`) {
    hash ^= char.codePointAt(0)!
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

export function pendingKeys(
  strings: Map<string, ReviewableString>,
  checks: readonly Pick<TranslationVerification, 'strings'>[],
): string[] {
  return [...strings]
    .filter(([key, string]) => {
      const fingerprint = stringFingerprint(string)
      return !checks.some((check) => check.strings?.[key] === fingerprint)
    })
    .map(([key]) => key)
}

export function placeholders(text: string): string[] {
  return [...new Set(text.match(/\{[^{}]+\}/g) ?? [])].sort()
}

export function samePlaceholders(source: string, translation: string): boolean {
  return placeholders(source).join() === placeholders(translation).join()
}

export function pluralFormCount(text: string): number {
  return text.split('|').length
}

export function formatReview(review: TranslationReview): string {
  return JSON.stringify(review, null, 2)
}

export function parseReview(text: string): TranslationReview | undefined {
  const json = text
    .trim()
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/, '')
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return undefined
  }
  if (!data || typeof data !== 'object') return undefined
  const r = data as Record<string, unknown>
  const changes = r.changes ?? {}
  if (
    typeof r.language !== 'string' ||
    typeof r.scope !== 'string' ||
    typeof r.commit !== 'string' ||
    (r.fluency !== undefined && r.fluency !== 'native' && r.fluency !== 'fluent') ||
    !changes ||
    typeof changes !== 'object' ||
    Array.isArray(changes) ||
    !Object.values(changes).every((v) => typeof v === 'string') ||
    (r.keys !== undefined && (!Array.isArray(r.keys) || !r.keys.every((k) => typeof k === 'string')))
  ) {
    return undefined
  }
  return {
    language: r.language,
    scope: r.scope,
    commit: r.commit,
    ...(r.fluency ? { fluency: r.fluency as Fluency } : {}),
    ...(r.keys ? { keys: r.keys as string[] } : {}),
    changes: changes as Record<string, string>,
  }
}

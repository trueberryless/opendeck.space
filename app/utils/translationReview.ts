import {
  type Fluency,
  parseVerificationPath,
  SOURCE_LANGUAGE,
  sourceText,
  translatableStrings,
  type TranslationVerification,
} from '~~/shared/translations'
import type { StarterPack } from '~/composables/useStarterPacks'

export const REVIEW_SECONDS_PER_STRING = 1
export const REVIEW_MIN_SECONDS = 5
const SECTION_SIZE = 25
const PACK_FIELDS = ['text', 'reading', 'note'] as const

export interface ReviewRow {
  key: string
  source: string
  value: string
  reading: boolean
}

export interface ReviewSection {
  id: string
  group: string
  part: number
  parts: number
  rows: ReviewRow[]
}

export interface ReviewProgress {
  fingerprint: string
  edits: Record<string, string>
  confirmed: string[]
  read: Record<string, number>
  fluency?: Fluency
}

const uiFiles = import.meta.glob<unknown>('../../i18n/*.json', { import: 'default' })
const checkFiles = import.meta.glob<TranslationVerification[]>('../data/verifications/**/*.json', {
  import: 'default',
})

export async function loadReviewChecks(scope: string, language: string): Promise<TranslationVerification[]> {
  const path = Object.keys(checkFiles).find((p) => {
    const file = parseVerificationPath(p)
    return file?.scope === scope && file.language === language
  })
  return path ? await checkFiles[path]!() : []
}

export async function loadReviewStrings(
  scope: string,
  language: string,
  pack?: StarterPack,
): Promise<{ english: Map<string, string>; target: Map<string, string> } | undefined> {
  if (scope === 'ui') {
    const [english, target] = await Promise.all(
      [SOURCE_LANGUAGE, language].map((code) => uiFiles[`../../i18n/${code}.json`]?.()),
    )
    if (!english || !target) return undefined
    return { english: translatableStrings('ui', english), target: translatableStrings('ui', target) }
  }
  const english = pack?.translations[SOURCE_LANGUAGE]
  const target = pack?.translations[language]
  if (!english || !target) return undefined
  return {
    english: translatableStrings(scope, { entries: english }),
    target: translatableStrings(scope, { entries: target }),
  }
}

function split(group: string, rows: ReviewRow[]): ReviewSection[] {
  const parts = Math.max(1, Math.round(rows.length / SECTION_SIZE))
  const size = Math.ceil(rows.length / parts)
  return Array.from({ length: parts }, (_, i) => ({
    id: parts > 1 ? `${group}-${i + 1}` : group,
    group,
    part: i + 1,
    parts,
    rows: rows.slice(i * size, (i + 1) * size),
  })).filter((s) => s.rows.length)
}

export function reviewSections(
  english: Map<string, string>,
  target: Map<string, string>,
  pack?: StarterPack,
  only?: ReadonlySet<string>,
): ReviewSection[] {
  const groups = new Map<string, ReviewRow[]>()
  const add = (group: string, key: string, reading = false) => {
    const value = target.get(key)
    const source = sourceText(english, key)
    if (value === undefined || source === undefined || (only && !only.has(key))) return
    groups.set(group, [...(groups.get(group) ?? []), { key, source, value, reading }])
  }
  if (pack) {
    for (const entry of pack.entries) {
      for (const field of PACK_FIELDS) add(entry.section, `entries.${entry.key}.${field}`, field === 'reading')
    }
  } else {
    for (const key of english.keys()) add(key.split('.')[0]!, key)
  }
  return [...groups].flatMap(([group, rows]) => split(group, rows))
}

export function requiredSeconds(section: ReviewSection): number {
  return Math.max(REVIEW_MIN_SECONDS, section.rows.length * REVIEW_SECONDS_PER_STRING)
}

export function reviewFingerprint(sections: ReviewSection[]): string {
  let hash = 5381
  for (const section of sections) {
    for (const row of section.rows) {
      for (const char of `${row.key}\u0000${row.source}\u0000${row.value}\u0001`) {
        hash = ((hash << 5) + hash + char.charCodeAt(0)) | 0
      }
    }
  }
  return (hash >>> 0).toString(36)
}

export type ReviewMode = 'changes' | 'all'

export function reviewStorageKey(language: string, scope: string, mode: ReviewMode): string {
  return `opendeck-translation-review:${language}:${scope}${mode === 'changes' ? ':changes' : ''}`
}

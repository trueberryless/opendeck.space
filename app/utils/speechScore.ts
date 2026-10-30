import { speechLanguage } from '~/utils/speech'

const CHARACTER_LANGUAGES = new Set(['bo', 'ja', 'km', 'lo', 'my', 'th', 'yue', 'zh'])
const PUNCTUATION_RE = /[\p{P}\p{S}]/gu
const SPACE_RE = /\s+/gu
const KATAKANA_RE = /[ァ-ヶ]/gu
const ALTERNATIVE_RE = /\s+\/\s+/u
const KATAKANA_OFFSET = 0x60

export type DiffKind = 'same' | 'changed' | 'missing' | 'extra'

export interface DiffPart {
  expected?: string
  heard?: string
  kind: DiffKind
}

export interface SpeechScore {
  expected: string
  parts: DiffPart[]
  score: number
}

export function comparesCharacters(lang: string | undefined): boolean {
  return CHARACTER_LANGUAGES.has(speechLanguage(lang) ?? '')
}

export function normalizeSpeech(text: string, lang: string | undefined): string {
  const language = speechLanguage(lang)
  let out = lowerCase(text.normalize('NFKC'), language)
  out = out.replace(PUNCTUATION_RE, ' ')
  if (language === 'ja') out = toHiragana(out)
  out = out.replace(SPACE_RE, ' ').trim()
  return comparesCharacters(lang) ? out.replaceAll(' ', '') : out
}

export function speechTokens(text: string, lang: string | undefined): string[] {
  const normalized = normalizeSpeech(text, lang)
  if (!normalized) return []
  return comparesCharacters(lang) ? graphemes(normalized) : normalized.split(' ')
}

export function diffTokens(expected: readonly string[], heard: readonly string[]): DiffPart[] {
  const cols = heard.length + 1
  const cost = Array.from({ length: (expected.length + 1) * cols }, () => 0)
  const at = (i: number, j: number) => cost[i * cols + j] ?? Number.POSITIVE_INFINITY
  const step = (i: number, j: number) => (expected[i - 1] === heard[j - 1] ? 0 : 1)

  for (let i = 0; i <= expected.length; i++) {
    for (let j = 0; j <= heard.length; j++) {
      cost[i * cols + j] =
        i === 0 || j === 0 ? i + j : Math.min(at(i - 1, j - 1) + step(i, j), at(i - 1, j) + 1, at(i, j - 1) + 1)
    }
  }

  const parts: DiffPart[] = []
  let i = expected.length
  let j = heard.length
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && at(i, j) === at(i - 1, j - 1) + step(i, j)) {
      parts.push({ kind: step(i, j) ? 'changed' : 'same', expected: expected[i - 1], heard: heard[j - 1] })
      i--
      j--
    } else if (i > 0 && at(i, j) === at(i - 1, j) + 1) {
      parts.push({ kind: 'missing', expected: expected[i - 1] })
      i--
    } else {
      parts.push({ kind: 'extra', heard: heard[j - 1] })
      j--
    }
  }
  return parts.toReversed()
}

export function similarity(expected: string, heard: string, lang: string | undefined): number {
  const a = graphemes(normalizeSpeech(expected, lang).replaceAll(' ', ''))
  const b = graphemes(normalizeSpeech(heard, lang).replaceAll(' ', ''))
  const longest = Math.max(a.length, b.length)
  if (longest === 0) return 0
  const distance = diffTokens(a, b).filter((p) => p.kind !== 'same').length
  return Math.max(0, 1 - distance / longest)
}

export function expectedForms(text: string, readings: readonly (string | undefined)[] = []): string[] {
  const forms = [text, ...readings].flatMap((form) => {
    const trimmed = form?.trim()
    if (!trimmed) return []
    const alternatives = trimmed.split(ALTERNATIVE_RE).filter(Boolean)
    return alternatives.length > 1 ? [trimmed].concat(completeAlternatives(alternatives)) : [trimmed]
  })
  return [...new Set(forms)]
}

function completeAlternatives(alternatives: readonly string[]): string[] {
  const [first = '', ...rest] = alternatives
  const words = first.split(SPACE_RE)
  return [
    first,
    ...rest.map((alternative) => {
      const missing = words.length - alternative.split(SPACE_RE).length
      return missing > 0 ? words.slice(0, missing).concat(alternative).join(' ') : alternative
    }),
  ]
}

export function scoreSpeech(
  text: string,
  heard: string,
  lang: string | undefined,
  readings: readonly (string | undefined)[] = [],
): SpeechScore {
  const forms = expectedForms(text, readings)
  let best: SpeechScore = { expected: text, parts: [], score: -1 }
  for (const form of forms) {
    const score = Math.round(similarity(form, heard, lang) * 100)
    if (score > best.score) best = { expected: form, parts: [], score }
  }
  best.parts = diffTokens(speechTokens(best.expected, lang), speechTokens(heard, lang))
  best.score = Math.max(0, best.score)
  return best
}

function lowerCase(text: string, language: string | undefined): string {
  try {
    return text.toLocaleLowerCase(language)
  } catch {
    return text.toLowerCase()
  }
}

function toHiragana(text: string): string {
  return text.replace(KATAKANA_RE, (char) => String.fromCodePoint((char.codePointAt(0) ?? 0) - KATAKANA_OFFSET))
}

function graphemes(text: string): string[] {
  return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (s) => s.segment)
}

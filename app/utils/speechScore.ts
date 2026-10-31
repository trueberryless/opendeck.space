import { romajiToHiragana } from '~/utils/romaji'
import { speechLanguage } from '~/utils/speech'

const CHARACTER_LANGUAGES = new Set(['bo', 'ja', 'km', 'lo', 'my', 'th', 'yue', 'zh'])
const PUNCTUATION_RE = /[\p{P}\p{S}]/gu
const SPACE_RE = /\s+/gu
const KATAKANA_RE = /[ァ-ヶ]/gu
const ALTERNATIVE_RE = /\s+\/\s+/u
const KATAKANA_OFFSET = 0x60
const JAPANESE_SOUNDS_RE = /[はをへー]/gu
const JAPANESE_SOUNDS: Record<string, string> = { は: 'わ', を: 'お', へ: 'え', ー: '' }
const NEAR_WORD = 0.8
const FULL_MARKS_AT = 0.9

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
  if (language === 'ja') out = romajiToHiragana(out)
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

function soundKey(text: string, lang: string | undefined): string {
  if (speechLanguage(lang) !== 'ja') return text
  return text.replace(JAPANESE_SOUNDS_RE, (char) => JAPANESE_SOUNDS[char] ?? char)
}

function tokensMatch(lang: string | undefined): (expected: string, heard: string) => boolean {
  if (comparesCharacters(lang)) return (expected, heard) => soundKey(expected, lang) === soundKey(heard, lang)
  return (expected, heard) => expected === heard || wordSimilarity(expected, heard) >= NEAR_WORD
}

export function diffTokens(
  expected: readonly string[],
  heard: readonly string[],
  same: (expected: string, heard: string) => boolean = (a, b) => a === b,
): DiffPart[] {
  const cols = heard.length + 1
  const cost = Array.from({ length: (expected.length + 1) * cols }, () => 0)
  const at = (i: number, j: number) => cost[i * cols + j] ?? Number.POSITIVE_INFINITY
  const step = (i: number, j: number) => (same(expected[i - 1] ?? '', heard[j - 1] ?? '') ? 0 : 1)

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
  const a = soundKey(normalizeSpeech(expected, lang).replaceAll(' ', ''), lang)
  const b = soundKey(normalizeSpeech(heard, lang).replaceAll(' ', ''), lang)
  return wordSimilarity(a, b)
}

function forgivingScore(similarityValue: number): number {
  return Math.round(100 * Math.min(1, similarityValue / FULL_MARKS_AT))
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
  let expected = text
  let closest = -1
  for (const form of expectedForms(text, readings)) {
    const value = similarity(form, heard, lang)
    if (value > closest) {
      expected = form
      closest = value
    }
  }
  return {
    expected,
    parts: diffTokens(speechTokens(expected, lang), speechTokens(heard, lang), tokensMatch(lang)),
    score: forgivingScore(Math.max(0, closest)),
  }
}

function wordSimilarity(expected: string, heard: string): number {
  const a = graphemes(expected)
  const b = graphemes(heard)
  const longest = Math.max(a.length, b.length)
  if (longest === 0) return 0
  const distance = diffTokens(a, b).filter((p) => p.kind !== 'same').length
  return Math.max(0, 1 - distance / longest)
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

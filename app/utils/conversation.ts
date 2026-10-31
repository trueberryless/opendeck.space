import type { ProgressValue } from '~/utils/records'

export const MAX_VOCABULARY = 30
export const MAX_ASSISTANT_URL_LENGTH = 4000

export const ASSISTANTS = [
  { id: 'chatgpt', name: 'ChatGPT', base: 'https://chatgpt.com/?q=' },
  { id: 'claude', name: 'Claude', base: 'https://claude.ai/new?q=' },
] as const

export type Assistant = (typeof ASSISTANTS)[number]
export type AssistantId = Assistant['id']

export interface VocabularyCard {
  progress: readonly Pick<ProgressValue, 'dueAt' | 'lastReviewedAt' | 'state'>[]
  reading?: string
  text: string
}

export interface FittedPrompt {
  prompt: string
  words: string[]
}

export function vocabularyWord(card: Pick<VocabularyCard, 'reading' | 'text'>): string {
  const text = card.text.trim()
  const reading = card.reading?.trim()
  return reading && reading !== text ? `${text} (${reading})` : text
}

export function pickVocabulary(cards: readonly VocabularyCard[], now: Date, limit = MAX_VOCABULARY): string[] {
  const time = now.getTime()
  const ranked = cards
    .filter((card) => card.text.trim())
    .map((card, index) => ({
      index,
      rank: rankCard(card, time),
      recent: lastReviewed(card),
      word: vocabularyWord(card),
    }))
    .sort((a, b) => a.rank - b.rank || b.recent - a.recent || a.index - b.index)
  return [...new Set(ranked.map((r) => r.word))].slice(0, Math.max(0, limit))
}

export function fitPrompt(
  words: readonly string[],
  render: (words: readonly string[]) => string,
  fits: (prompt: string) => boolean,
): FittedPrompt | undefined {
  for (let count = words.length; count >= 0; count--) {
    const chosen = words.slice(0, count)
    const prompt = render(chosen)
    if (fits(prompt)) return { prompt, words: chosen }
  }
  return undefined
}

export function assistantUrl(assistant: Assistant, prompt: string): string {
  return `${assistant.base}${encodeURIComponent(prompt)}`
}

export function assistantPrompt(
  assistant: Assistant,
  words: readonly string[],
  render: (words: readonly string[]) => string,
  maxLength = MAX_ASSISTANT_URL_LENGTH,
): FittedPrompt | undefined {
  return fitPrompt(words, render, (prompt) => assistantUrl(assistant, prompt).length <= maxLength)
}

function rankCard(card: VocabularyCard, time: number): number {
  const studied = card.progress.filter((p) => p.state !== 'new')
  if (studied.some((p) => new Date(p.dueAt).getTime() <= time)) return 0
  if (studied.some((p) => p.state === 'learning' || p.state === 'relearning')) return 1
  if (studied.length) return 2
  return 3
}

function lastReviewed(card: VocabularyCard): number {
  return Math.max(0, ...card.progress.map((p) => new Date(p.lastReviewedAt).getTime() || 0))
}

import { describe, expect, it } from 'vitest'
import {
  ASSISTANTS,
  assistantPrompt,
  assistantUrl,
  fitPrompt,
  MAX_ASSISTANT_URL_LENGTH,
  pickVocabulary,
  vocabularyWord,
  type VocabularyCard,
} from '~/utils/conversation'

const NOW = new Date('2026-10-20T12:00:00Z')
const [CHATGPT, CLAUDE] = ASSISTANTS

function card(text: string, progress: Partial<VocabularyCard['progress'][number]>[] = [], reading?: string) {
  return {
    text,
    reading,
    progress: progress.map((p) => ({
      state: 'review' as const,
      dueAt: '2026-11-01T00:00:00Z',
      lastReviewedAt: '2026-10-01T00:00:00Z',
      ...p,
    })),
  }
}

describe('pickVocabulary', () => {
  it('prefers due cards, then learning ones, then recently reviewed, then new', () => {
    const cards = [
      card('nuevo'),
      card('viejo', [{ lastReviewedAt: '2026-09-01T00:00:00Z' }]),
      card('reciente', [{ lastReviewedAt: '2026-10-19T00:00:00Z' }]),
      card('aprendiendo', [{ state: 'learning' }]),
      card('pendiente', [{ dueAt: '2026-10-20T11:00:00Z' }]),
      card('olvidado', [{ state: 'relearning', dueAt: '2026-10-19T00:00:00Z' }]),
    ]
    expect(pickVocabulary(cards, NOW)).toEqual(['pendiente', 'olvidado', 'aprendiendo', 'reciente', 'viejo', 'nuevo'])
  })

  it('looks at both study directions of a card', () => {
    const cards = [card('a', [{}]), card('b', [{ state: 'new', dueAt: '2026-01-01T00:00:00Z' }, { state: 'learning' }])]
    expect(pickVocabulary(cards, NOW)).toEqual(['b', 'a'])
  })

  it('adds readings, skips blanks and duplicates and stops at the limit', () => {
    const cards = [card('犬', [], 'いぬ'), card('犬', [], 'いぬ'), card('  '), card('猫', [], '猫'), card('鳥')]
    expect(pickVocabulary(cards, NOW)).toEqual(['犬 (いぬ)', '猫', '鳥'])
    expect(pickVocabulary(cards, NOW, 2)).toEqual(['犬 (いぬ)', '猫'])
    expect(pickVocabulary(cards, NOW, -1)).toEqual([])
  })

  it('formats a single word with its reading', () => {
    expect(vocabularyWord({ text: ' hola ', reading: ' ' })).toBe('hola')
  })
})

describe('fitPrompt', () => {
  const render = (words: readonly string[]) => `Use: ${words.join(', ')}`

  it('keeps as many words as fit', () => {
    expect(fitPrompt(['uno', 'dos', 'tres'], render, (p) => p.length <= 13)).toEqual({
      prompt: 'Use: uno, dos',
      words: ['uno', 'dos'],
    })
  })

  it('gives up when even the bare prompt is too long', () => {
    expect(fitPrompt(['uno'], render, () => false)).toBeUndefined()
  })
})

describe('assistant links', () => {
  it('prefills the composer of ChatGPT and Claude with the encoded prompt', () => {
    expect(assistantUrl(CHATGPT, 'Hola & adiós?')).toBe('https://chatgpt.com/?q=Hola%20%26%20adi%C3%B3s%3F')
    expect(assistantUrl(CLAUDE, '#1 / 100%')).toBe('https://claude.ai/new?q=%231%20%2F%20100%25')
  })

  it('trims the vocabulary so the link stays short enough to open everywhere', () => {
    const words = Array.from({ length: 400 }, (_, i) => `単語${i}`)
    const render = (list: readonly string[]) => `日本語を話す練習をしましょう。${list.join('、')}`
    const fitted = assistantPrompt(CHATGPT, words, render)
    expect(fitted?.words.length).toBeGreaterThan(10)
    expect(fitted?.words.length).toBeLessThan(400)
    expect(assistantUrl(CHATGPT, fitted?.prompt ?? '').length).toBeLessThanOrEqual(MAX_ASSISTANT_URL_LENGTH)
    expect(assistantUrl(CHATGPT, render(words.slice(0, (fitted?.words.length ?? 0) + 1))).length).toBeGreaterThan(
      MAX_ASSISTANT_URL_LENGTH,
    )
  })

  it('offers no link when the prompt alone is too long', () => {
    expect(assistantPrompt(CLAUDE, [], () => 'x'.repeat(5000))).toBeUndefined()
  })
})

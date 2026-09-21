import type { ParsedCard, ParseResult } from './types'

export interface QuizletOptions {
  title: string
  termDelim: string
  cardDelim: string
}

export function parseQuizlet(text: string, opts: QuizletOptions): ParseResult {
  const cards: ParsedCard[] = []
  const termDelim = opts.termDelim || '\t'
  const rows = text.split(opts.cardDelim || '\n')

  for (const row of rows) {
    const line = row.replace(/\r$/, '').trim()
    if (!line) continue
    const idx = line.indexOf(termDelim)
    if (idx === -1) {
      cards.push({ front: line, back: '' })
      continue
    }
    const front = line.slice(0, idx).trim()
    const back = line.slice(idx + termDelim.length).trim()
    if (front) cards.push({ front, back })
  }

  return {
    decks: [{ title: opts.title || 'Quizlet import', cards, tags: ['quizlet'] }],
    warnings: cards.length ? [] : ['No cards parsed. Check the delimiters.'],
  }
}

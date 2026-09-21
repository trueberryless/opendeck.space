import type { ParsedCard, ParseResult } from './types'

export interface CsvOptions {
  title: string
  delimiter?: string
  hasHeader?: boolean
  columns?: { front: number; back: number; hint?: number }
}

export function parseCsv(text: string, opts: CsvOptions): ParseResult {
  const delimiter = opts.delimiter ?? (text.includes('\t') ? '\t' : ',')
  const rows = parseRows(text, delimiter).filter((r) => r.some((c) => c.trim() !== ''))
  const cols = opts.columns ?? { front: 0, back: 1, hint: 2 }

  const startedWithHeader = opts.hasHeader ?? looksLikeHeader(rows[0])
  const dataRows = startedWithHeader ? rows.slice(1) : rows

  const cards: ParsedCard[] = []
  for (const row of dataRows) {
    const front = (row[cols.front] ?? '').trim()
    const back = (row[cols.back] ?? '').trim()
    if (!front && !back) continue
    const card: ParsedCard = { front, back }
    const hint = cols.hint != null ? (row[cols.hint] ?? '').trim() : ''
    if (hint) card.hint = hint
    cards.push(card)
  }

  return {
    decks: [{ title: opts.title || 'CSV import', cards, tags: ['csv'] }],
    warnings: cards.length ? [] : ['No rows parsed.'],
  }
}

function looksLikeHeader(row: string[] | undefined): boolean {
  if (!row) return false
  const first = (row[0] ?? '').trim().toLowerCase()
  return ['front', 'term', 'question', 'word'].includes(first)
}

function parseRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

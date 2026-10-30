const LINE_RE = /\r?\n+/u
const SPACE_RE = /\s+/gu
const WORDLIKE_RE = /[\p{L}\p{N}]/u

export const MAX_SENTENCES = 200
export const MAX_TEXT_BYTES = 200_000

export function splitSentences(text: string, lang: string | undefined, max = MAX_SENTENCES): string[] {
  const segmenter = new Intl.Segmenter(safeLocale(lang), { granularity: 'sentence' })
  const sentences: string[] = []
  for (const line of text.split(LINE_RE)) {
    for (const { segment } of segmenter.segment(line)) {
      const sentence = segment.replace(SPACE_RE, ' ').trim()
      if (!WORDLIKE_RE.test(sentence)) continue
      sentences.push(sentence)
      if (sentences.length >= max) return sentences
    }
  }
  return sentences
}

function safeLocale(lang: string | undefined): string | undefined {
  if (!lang) return undefined
  try {
    return Intl.getCanonicalLocales(lang)[0]
  } catch {
    return undefined
  }
}

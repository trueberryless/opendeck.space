import { describe, expect, it } from 'vitest'
import { parseCsv } from '~/utils/import/csv'
import { parseOpenDeckJson } from '~/utils/import/json'
import { parseQuizlet } from '~/utils/import/quizlet'
import { htmlToText, mediaKind, mimeFor, totalCards, totalMedia, type ParsedDeck } from '~/utils/import/types'

describe('parseCsv', () => {
  it('parses comma separated rows with a hint column', () => {
    const { decks, warnings } = parseCsv('hello,hallo,greeting\nbye,tschüss', { title: 'Words', hasHeader: false })
    expect(warnings).toEqual([])
    expect(decks).toEqual([
      {
        title: 'Words',
        tags: ['csv'],
        cards: [
          { front: 'hello', back: 'hallo', hint: 'greeting' },
          { front: 'bye', back: 'tschüss' },
        ],
      },
    ])
  })

  it('detects tabs and a header row', () => {
    const { decks } = parseCsv('front\tback\na\tb', { title: '' })
    expect(decks[0]).toMatchObject({ title: 'CSV import', cards: [{ front: 'a', back: 'b' }] })
  })

  it('handles quoted fields with delimiters, quotes and newlines, and CRLF', () => {
    const { decks } = parseCsv('"a, b","say ""hi""\r\nagain"\r\nc,d', { title: 't', hasHeader: false })
    expect(decks[0]!.cards).toEqual([
      { front: 'a, b', back: 'say "hi"\nagain' },
      { front: 'c', back: 'd' },
    ])
  })

  it('honours custom delimiters and columns', () => {
    const { decks } = parseCsv('x;a;b;c', { title: 't', delimiter: ';', columns: { front: 2, back: 1, hint: 3 } })
    expect(decks[0]!.cards).toEqual([{ front: 'b', back: 'a', hint: 'c' }])
  })

  it('skips blank rows and warns when nothing was parsed', () => {
    expect(parseCsv('\n , \n', { title: 't' })).toMatchObject({ warnings: ['No rows parsed.'] })
    expect(parseCsv('', { title: 't' }).decks[0]!.cards).toEqual([])
  })

  it('keeps the last field of a file without a trailing newline', () => {
    expect(parseCsv('a,b', { title: 't', hasHeader: false }).decks[0]!.cards).toHaveLength(1)
  })
})

describe('parseQuizlet', () => {
  it('splits cards and terms with the given delimiters', () => {
    const { decks } = parseQuizlet('a - b;;c - d', { title: 'Q', termDelim: ' - ', cardDelim: ';;' })
    expect(decks[0]).toMatchObject({
      title: 'Q',
      tags: ['quizlet'],
      cards: [
        { front: 'a', back: 'b' },
        { front: 'c', back: 'd' },
      ],
    })
  })

  it('defaults to tab and newline, keeping lines without a term delimiter as fronts', () => {
    const { decks } = parseQuizlet('a\tb\r\nlonely\n\n', { title: '', termDelim: '', cardDelim: '' })
    expect(decks[0]!.title).toBe('Quizlet import')
    expect(decks[0]!.cards).toEqual([
      { front: 'a', back: 'b' },
      { front: 'lonely', back: '' },
    ])
  })

  it('warns when nothing was parsed', () => {
    expect(parseQuizlet('', { title: 't', termDelim: '\t', cardDelim: '\n' }).warnings).toHaveLength(1)
  })
})

describe('parseOpenDeckJson', () => {
  const b64 = (text: string) => btoa(text)

  it('parses an export, mapping legacy phonetic fields and decoding media', () => {
    const { decks, warnings } = parseOpenDeckJson(
      JSON.stringify({
        app: 'opendeck',
        version: 1,
        decks: [
          {
            title: 'D',
            sourceLang: 'de',
            cards: [
              {
                front: 'a',
                back: 'b',
                phonetic: 'pb',
                phoneticFront: 'pf',
                image: { filename: 'x.png', mime: 'image/png', base64: b64('img') },
                audio: { filename: 'noext', mime: 'audio/x', base64: b64('snd') },
              },
              { front: 'c', back: 'd', image: { filename: 'noext', mime: 'image/x', base64: b64('i') } },
            ],
          },
        ],
      }),
    )
    expect(warnings).toEqual([])
    const [first, second] = decks[0]!.cards
    expect(first).toMatchObject({ backReading: 'pb', frontReading: 'pf' })
    expect(first!.image).toMatchObject({ filename: 'x.png', kind: 'image', mime: 'image/png' })
    expect([...first!.image!.bytes]).toEqual([...new TextEncoder().encode('img')])
    expect(first!.audio!.kind).toBe('audio')
    expect(second!.image!.kind).toBe('image')
  })

  it('warns about undecodable media and drops it', () => {
    const { decks, warnings } = parseOpenDeckJson(
      JSON.stringify({
        decks: [
          {
            title: 'D',
            cards: [{ front: 'a', back: 'b', image: { filename: 'x.png', mime: 'image/png', base64: '***' } }],
          },
        ],
      }),
    )
    expect(decks[0]!.cards[0]!.image).toBeUndefined()
    expect(warnings).toEqual(['Could not decode media x.png.'])
  })

  it('rejects invalid input', () => {
    expect(() => parseOpenDeckJson('nope')).toThrow('Not valid JSON.')
    expect(() => parseOpenDeckJson('{}')).toThrow('Not an OpenDeck export.')
    expect(() => parseOpenDeckJson('null')).toThrow('Not an OpenDeck export.')
  })
})

describe('media helpers', () => {
  it('detects the media kind from the extension', () => {
    expect(mediaKind('a.PNG')).toBe('image')
    expect(mediaKind('a.mp3')).toBe('audio')
    expect(mediaKind('a.txt')).toBeNull()
    expect(mediaKind('noext')).toBeNull()
  })

  it('maps extensions to mime types', () => {
    expect(mimeFor('a.jpg')).toBe('image/jpeg')
    expect(mimeFor('a.m4a')).toBe('audio/mp4')
    expect(mimeFor('a.bin')).toBe('application/octet-stream')
  })
})

describe('htmlToText', () => {
  it('converts breaks and blocks, strips tags and decodes entities', () => {
    expect(htmlToText('<div>a&nbsp;&amp;&lt;b&gt;</div><p>"x"&quot;&#39;</p>line<br/>two')).toBe(
      'a &<b>\n"x""\'\nline\ntwo',
    )
  })

  it('collapses excess blank lines and trailing spaces', () => {
    expect(htmlToText('a  <br><br><br><br>b')).toBe('a\n\nb')
  })
})

describe('totals', () => {
  const decks: ParsedDeck[] = [
    {
      title: 'a',
      cards: [
        { front: '', back: '', image: {} as never },
        { front: '', back: '', audio: {} as never, image: {} as never },
      ],
    },
    { title: 'b', cards: [{ front: '', back: '' }] },
  ]

  it('counts cards and media', () => {
    expect(totalCards(decks)).toBe(3)
    expect(totalMedia(decks)).toBe(3)
  })
})

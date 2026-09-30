import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { inSetup } from '../support/nuxt'
import '../support/reset'

const issue = (over: object = {}) => ({
  number: 12,
  title: 'Review: de ui',
  body: '{"language": "de", "scope": "ui"}',
  state: 'open',
  created_at: new Date().toISOString(),
  html_url: 'https://github.com/x/y/issues/12',
  labels: [],
  ...over,
})

const start = { language: 'de', scope: 'ui', approve: true, title: 'Review: de ui', url: 'https://github.com/new' }

function github(handler: (url: string) => unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const result = handler(String(url))
      return result instanceof Response ? result : Response.json(result)
    }),
  )
}

function setup(language = 'de', file = 'ui') {
  return inSetup(() => useReviewSubmission(ref(language), ref(file)))
}

beforeEach(() => {
  github(() => [])
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
})

afterEach(() => vi.useRealTimers())

describe('useReviewSubmission', () => {
  it('has no submission at first', async () => {
    const review = await setup()
    expect(review.submission.value).toBeUndefined()
    expect(review.status.value).toBeUndefined()
  })

  it('searches for the created issue and tracks its state', async () => {
    github((url) => (url.includes('?state=all') ? [issue()] : issue()))
    const review = await setup()
    review.start(start)
    expect(review.status.value).toBe('searching')
    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(review.status.value).toBe('received'))
    expect(review.submission.value).toMatchObject({ issue: 12, issueUrl: 'https://github.com/x/y/issues/12' })
    expect(review.title.value).toContain('12')
  })

  it.each([
    ['approved', { labels: [{ name: 'translation-approved' }] }],
    ['done', { state: 'closed', state_reason: 'completed' }],
    ['closed', { state: 'closed', state_reason: 'not_planned' }],
  ])('reports the %s state', async (state, over) => {
    github(() => [issue(over)])
    const review = await setup()
    review.start(start)
    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(review.status.value).toBe(state))
    expect(review.title.value).toBeTruthy()
  })

  it('ignores pull requests, old issues and unrelated issues', async () => {
    github(() => [
      issue({ pull_request: {} }),
      issue({ created_at: '2000-01-01T00:00:00Z' }),
      issue({ title: 'other', body: '{"language": "fr"}' }),
    ])
    const review = await setup()
    review.start(start)
    window.dispatchEvent(new Event('focus'))
    await new Promise((r) => setTimeout(r, 20))
    expect(review.submission.value!.issue).toBeUndefined()
  })

  it('matches a fix issue with a part by its body', async () => {
    github(() => [issue({ title: 'x', body: '{"language": "de", "scope": "ui", "part": "basics"}' })])
    const review = await setup()
    review.start({ ...start, approve: false, part: 'basics' })
    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(review.status.value).toBe('received'))
  })

  it('reports an unreachable GitHub and a lost issue', async () => {
    github(() => new Response('', { status: 500 }))
    const review = await setup()
    review.start(start)
    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(review.status.value).toBe('unreachable'))
  })

  it('says not found after a while', async () => {
    const review = await setup()
    review.start({ ...start })
    review.submission.value = { ...review.submission.value!, sentAt: Date.now() - 120_000 }
    await vi.waitFor(() => expect(review.status.value).toBe('notFound'))
  })

  it('can be marked as created manually and dismissed', async () => {
    const review = await setup()
    review.start(start)
    review.markCreated()
    expect(review.status.value).toBe('manual')
    expect(review.title.value).toBeTruthy()
    review.dismiss()
    expect(review.submission.value).toBeUndefined()
  })

  it('restores an unfinished submission and forgets a finished one', async () => {
    localStorage.setItem(
      'opendeck-translation-review:de:ui:sent',
      JSON.stringify({ ...start, sentAt: Date.now(), issue: 3, state: 'received' }),
    )
    localStorage.setItem(
      'opendeck-translation-review:fr:ui:sent',
      JSON.stringify({ ...start, sentAt: Date.now(), issue: 3, state: 'done' }),
    )
    github(() => issue({ number: 3 }))
    const restored = await setup('de')
    expect(restored.submission.value?.issue).toBe(3)
    const finished = await setup('fr')
    expect(finished.status.value).toBe('done')
    expect(localStorage.getItem('opendeck-translation-review:fr:ui:sent')).toBeNull()
  })

  it('persists a new submission and survives corrupt storage', async () => {
    localStorage.setItem('opendeck-translation-review:es:ui:sent', '{nope')
    const review = await setup('es')
    expect(review.submission.value).toBeUndefined()
    review.start({ ...start, language: 'es' })
    await vi.waitFor(() =>
      expect(localStorage.getItem('opendeck-translation-review:es:ui:sent')).toContain('"language":"es"'),
    )
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const status = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}))

vi.mock('virtual:translation-status', () => ({
  get default() {
    return status.value
  },
}))

const check = (github: string, extra: object = {}) => ({
  github,
  fluency: 'fluent',
  date: '2026-02-01',
  commit: 'c',
  issue: 1,
  ...extra,
})

beforeEach(() => {
  status.value = {
    'ui/de': { checks: [check('alice', { did: 'did:plc:a', name: 'Alice' })], pending: 0, total: 10 },
    'ui/fr': { checks: [], pending: 5, total: 5 },
    'garden/de': {
      checks: [check('alice', { fluency: 'native', date: '2026-01-01' }), check('bob')],
      pending: 2,
      total: 8,
    },
    'garden/es': { checks: [check('bob')], pending: 0, total: 8 },
  }
})

describe('translationCredits', () => {
  it('groups checks per person, merging languages and scopes', async () => {
    const { translationCredits } = await import('~/utils/translations')
    const [alice, bob] = translationCredits()
    expect(alice).toMatchObject({ github: 'alice', name: 'Alice', files: 2, since: '2026-01-01' })
    expect(alice!.languages).toEqual([{ code: 'de', fluency: 'native', scopes: ['ui', 'garden'] }])
    expect(bob).toMatchObject({ github: 'bob', files: 2 })
    expect(bob!.languages.map((l) => l.code)).toEqual(['de', 'es'])
  })
})

describe('hasCheckedTranslations', () => {
  it('matches by did or github user', async () => {
    const { hasCheckedTranslations } = await import('~/utils/translations')
    expect(hasCheckedTranslations('did:plc:a')).toBe(true)
    expect(hasCheckedTranslations('did:other', 'BOB')).toBe(true)
    expect(hasCheckedTranslations('did:other', 'carol')).toBe(false)
  })
})

describe('verifications', () => {
  it('reads checks per scope and language', async () => {
    const { packVerifications, uiVerifications } = await import('~/utils/translations')
    expect(uiVerifications('de')).toHaveLength(1)
    expect(uiVerifications('xx')).toEqual([])
    expect(packVerifications('garden', 'de')).toHaveLength(2)
  })
})

describe('reviewShare', () => {
  it('summarizes how much of the given scopes is checked', async () => {
    const { reviewShare } = await import('~/utils/translations')
    expect(reviewShare(['ui', 'garden'], 'de')).toEqual({ checked: 16, total: 18, state: 'partly' })
    expect(reviewShare(['garden'], 'es').state).toBe('full')
    expect(reviewShare(['ui'], 'fr').state).toBe('none')
    expect(reviewShare(['ui'], 'xx')).toEqual({ checked: 0, total: 0, state: 'none' })
  })
})

describe('checked state', () => {
  it('treats the source language as checked and needs a check with nothing pending otherwise', async () => {
    const { isOriginalLanguage, isPackChecked, isPackVerified, isUiChecked } = await import('~/utils/translations')
    expect(isOriginalLanguage('en')).toBe(true)
    expect(isUiChecked('en')).toBe(true)
    expect(isUiChecked('de')).toBe(true)
    expect(isUiChecked('fr')).toBe(false)
    expect(isPackChecked({ id: 'garden' }, 'de')).toBe(false)
    expect(isPackVerified({ id: 'garden', languages: ['en', 'es'] })).toBe(true)
    expect(isPackVerified({ id: 'garden', languages: ['en', 'de'] })).toBe(false)
  })
})

describe('reviewRoute', () => {
  it('builds the route with optional query', async () => {
    const { reviewRoute } = await import('~/utils/translations')
    expect(reviewRoute()).toEqual({ path: '/translations/review', query: {} })
    expect(reviewRoute('de', 'garden')).toEqual({ path: '/translations/review', query: { lang: 'de', file: 'garden' } })
  })
})

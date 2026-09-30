import { describe, expect, it, vi } from 'vitest'

const status = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}))

vi.mock('virtual:translation-status', () => ({
  get default() {
    return status.value
  },
}))

import registry from '~/data/credits/credits.json'
import { creditsFor, CREDIT_STYLES, ROLE_GLYPHS, ROLE_ICONS } from '~/utils/credits'
import { ROLES } from '~~/shared/credits'

const creator = registry.people.find((p) => p.roles?.includes('creator' as never))!

describe('creditsFor', () => {
  it('lists the roles of a registered person in canonical order with notes', () => {
    status.value = {}
    const credits = creditsFor(creator.did)
    expect(credits.map((c) => c.role)).toEqual(['creator', 'designer', 'tester'])
    expect(credits.find((c) => c.role === 'tester')).toEqual({ role: 'tester', note: 'Android' })
  })

  it('has no credits for strangers', () => {
    status.value = {}
    expect(creditsFor('did:plc:stranger')).toEqual([])
  })

  it('adds the translator role for anyone with a checked translation', () => {
    status.value = {
      'ui/de': {
        checks: [{ github: 'x', did: 'did:plc:stranger', fluency: 'fluent', date: '', commit: '', issue: 1 }],
        pending: 0,
        total: 1,
      },
    }
    expect(creditsFor('did:plc:stranger')).toEqual([{ role: 'translator' }])
    expect(creditsFor(creator.did).map((c) => c.role)).toContain('creator')
  })
})

describe('role tables', () => {
  it('has an icon and glyphs for every role', () => {
    for (const role of ROLES) {
      expect(ROLE_ICONS[role]).toMatch(/^i-lucide-/)
      expect(ROLE_GLYPHS[role].length).toBeGreaterThan(3)
    }
    expect(CREDIT_STYLES).toEqual(['theme', 'badges'])
  })
})

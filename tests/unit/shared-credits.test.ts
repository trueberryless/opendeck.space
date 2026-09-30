import { describe, expect, it } from 'vitest'
import { isDid, isGithubUser, isRole, normalizeHandle, sameGithubUser } from '~~/shared/credits'

describe('isRole', () => {
  it('accepts known roles only', () => {
    expect(isRole('translator')).toBe(true)
    expect(isRole('king')).toBe(false)
    expect(isRole(undefined)).toBe(false)
  })
})

describe('isDid', () => {
  it('accepts plc and web DIDs', () => {
    expect(isDid('did:plc:pbjvqaziagcyv2vqodldn5op')).toBe(true)
    expect(isDid('did:web:example.com')).toBe(true)
  })

  it('rejects everything else', () => {
    expect(isDid('did:plc:short')).toBe(false)
    expect(isDid('did:key:abc')).toBe(false)
    expect(isDid(4)).toBe(false)
  })
})

describe('isGithubUser', () => {
  it('validates GitHub usernames', () => {
    expect(isGithubUser('trueberryless')).toBe(true)
    expect(isGithubUser('a-b')).toBe(true)
    expect(isGithubUser('-a')).toBe(false)
    expect(isGithubUser('a--b')).toBe(false)
    expect(isGithubUser('x'.repeat(40))).toBe(false)
  })
})

describe('normalizeHandle', () => {
  it('strips prefixes and lowercases', () => {
    expect(normalizeHandle('  @Alice.Bsky.Social ')).toBe('alice.bsky.social')
    expect(normalizeHandle('at://bob.example.com')).toBe('bob.example.com')
  })

  it('rejects invalid handles', () => {
    expect(normalizeHandle('nodots')).toBeNull()
    expect(normalizeHandle('a.b-')).toBeNull()
    expect(normalizeHandle(`${'a'.repeat(250)}.com`)).toBeNull()
  })
})

describe('sameGithubUser', () => {
  it('compares case-insensitively and needs both values', () => {
    expect(sameGithubUser('Foo', 'foo')).toBe(true)
    expect(sameGithubUser('foo', undefined)).toBe(false)
    expect(sameGithubUser(undefined, undefined)).toBe(false)
  })
})

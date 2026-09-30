import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readAirspace } from '~/composables/useAirspace'
import { getBskyProfile, getBskyProfiles, resolveDid, searchBskyActors, searchBskyActorsTypeahead } from '~/utils/bsky'
import { getBacklinkDids } from '~/utils/constellation'
import { signIn } from '../support/session'

const remote = vi.hoisted(() => ({
  handler: (_url: string, _options?: unknown): unknown => undefined,
  calls: [] as [string, unknown][],
}))

mockNuxtImport('$fetch', (original) =>
  Object.assign(async (url: unknown, options?: unknown) => {
    if (
      typeof url === 'string' &&
      /^https:\/\/(public\.api\.bsky\.app|plc\.directory|constellation\.microcosm\.blue|example\.com)/.test(url)
    ) {
      remote.calls.push([url, options])
      const result = remote.handler(url, options)
      if (result instanceof Error) throw result
      return result
    }
    return (original as Function)(url, options)
  }, original),
)

const respond = (handler: (url: string, options?: unknown) => unknown) => void (remote.handler = handler)

beforeEach(() => {
  remote.calls.length = 0
  remote.handler = () => undefined
})

describe('getBacklinkDids', () => {
  it('maps the constellation response and forwards the cursor', async () => {
    respond(() => ({ total: 3, linking_dids: ['a', 'b'], cursor: 'next' }))
    expect(await getBacklinkDids('at://s', 'src', { limit: 2, cursor: 'c' })).toEqual({
      total: 3,
      dids: ['a', 'b'],
      cursor: 'next',
    })
    expect(remote.calls[0]![1]).toMatchObject({ query: { subject: 'at://s', source: 'src', limit: 2, cursor: 'c' } })
  })

  it('defaults the limit and cursor', async () => {
    respond(() => ({ total: 0, linking_dids: [] }))
    expect(await getBacklinkDids('s', 'src')).toEqual({ total: 0, dids: [], cursor: null })
    expect(remote.calls[0]![1]).toMatchObject({ query: { limit: 50 } })
  })
})

describe('bsky', () => {
  it('fetches a profile from the public appview', async () => {
    respond(() => ({ did: 'did:plc:a', handle: 'a.test' }))
    expect(await getBskyProfile('a.test')).toMatchObject({ did: 'did:plc:a' })
  })

  it('resolves handles and did documents when the appview fails', async () => {
    respond((url) => {
      if (url.includes('getProfile')) return new Error('x')
      if (url.includes('resolveHandle')) return { did: 'did:plc:a' }
      if (url.startsWith('https://plc.directory/')) return { alsoKnownAs: ['at://a.test'] }
      if (url.includes('.well-known/did.json')) return { alsoKnownAs: [] }
      if (url.endsWith('/x/did.json')) return { alsoKnownAs: ['at://x.test'] }
      return new Error('unexpected')
    })
    expect(await getBskyProfile('a.test')).toEqual({ did: 'did:plc:a', handle: 'a.test' })
    expect(await getBskyProfile('did:plc:a')).toEqual({ did: 'did:plc:a', handle: 'a.test' })
    expect(await getBskyProfile('did:web:example.com')).toEqual({
      did: 'did:web:example.com',
      handle: 'did:web:example.com',
    })
    expect(await getBskyProfile('did:web:example.com:x')).toEqual({ did: 'did:web:example.com:x', handle: 'x.test' })
    expect(await getBskyProfile('did:key:z')).toBeNull()
  })

  it('returns the signed in user when nothing else works', async () => {
    signIn()
    respond(() => new Error('down'))
    expect(await getBskyProfile('did:plc:me')).toEqual({ did: 'did:plc:me', handle: 'me.test' })
    useMe().value = { did: 'did:plc:me', handle: 'me.test', displayName: 'Me' }
    expect(await getBskyProfile('me.test')).toMatchObject({ displayName: 'Me' })
    expect(await getBskyProfile('stranger.test')).toBeNull()
  })

  it('uses the signed in user while offline', async () => {
    signIn()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    expect(await getBskyProfile('me.test')).toEqual({ did: 'did:plc:me', handle: 'me.test' })
    expect(await getBskyProfile('other.test')).toBeNull()
  })

  it('resolves dids', async () => {
    signIn()
    expect(await resolveDid('did:plc:x')).toBe('did:plc:x')
    expect(await resolveDid('me.test')).toBe('did:plc:me')
    respond(() => ({ did: 'did:plc:other', handle: 'other.test' }))
    expect(await resolveDid('other.test')).toBe('did:plc:other')
    respond(() => new Error('x'))
    expect(await resolveDid('nobody.test')).toBeNull()
  })

  it('batches profile lookups by 25', async () => {
    respond((url) => (url.includes('actors=bad') ? new Error('x') : { profiles: [{ did: 'd', handle: 'h' }] }))
    expect(await getBskyProfiles([])).toEqual([])
    expect(await getBskyProfiles(Array.from({ length: 30 }, (_, i) => `a${i}`))).toHaveLength(2)
    expect(await getBskyProfiles(['bad'])).toEqual([])
  })

  it('searches actors, ignoring blank queries and failures', async () => {
    respond(() => ({ actors: [{ did: 'd', handle: 'h' }] }))
    expect(await searchBskyActors('  ')).toEqual([])
    expect(await searchBskyActors('h')).toHaveLength(1)
    expect(await searchBskyActorsTypeahead('h')).toHaveLength(1)
    expect(await searchBskyActorsTypeahead('')).toEqual([])
    respond(() => new Error('x'))
    expect(await searchBskyActors('h')).toEqual([])
    expect(await searchBskyActorsTypeahead('h')).toEqual([])
  })
})

describe('useSocial', () => {
  it('follows, lists and unfollows', async () => {
    const airspace = signIn()
    const social = useSocial()
    const rkey = await social.follow('did:plc:friend')
    expect([...(await social.listMyFollows())]).toEqual([['did:plc:friend', rkey]])
    await social.unfollow(rkey)
    expect(airspace.follow.delete).toHaveBeenCalledWith(rkey)
  })

  it("lists someone else's follows without duplicates", async () => {
    signIn()
    vi.spyOn(readAirspace('did:plc:x').follow, 'list').mockResolvedValue([
      { value: { subject: 'a' } },
      { value: { subject: 'a' } },
      { value: { subject: 'b' } },
    ] as never)
    expect(await useSocial().listFollowingOf('did:plc:x')).toEqual(['a', 'b'])
  })

  it('reads follower pages and counts through constellation', async () => {
    respond(() => ({ total: 7, linking_dids: ['a'], cursor: null }))
    const social = useSocial()
    expect((await social.listFollowersOf('did:plc:x')).dids).toEqual(['a'])
    expect(await social.countFollowersOf('did:plc:x')).toBe(7)
  })
})

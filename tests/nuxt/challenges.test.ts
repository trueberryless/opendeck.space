import { describe, expect, it, vi } from 'vitest'
import { readAirspace } from '~/composables/useAirspace'
import { challengeWindow } from '~/utils/challenges'
import { dayKey } from '~/utils/day'
import { signIn } from '../support/session'

const linked = vi.hoisted(() => ({ dids: [] as string[] }))

vi.mock('~/utils/constellation', () => ({
  getBacklinkDids: async () => ({ total: linked.dids.length, dids: linked.dids, cursor: null }),
}))

describe('useChallenges', () => {
  it('creates a challenge and joins it', async () => {
    const airspace = signIn()
    useMotivation().studied.value = { [dayKey(new Date())]: 1 }
    const view = await useChallenges().create({ title: ' Week ', kind: 'studyDays', weeks: 1 })
    expect(view.value).toMatchObject({ title: 'Week', kind: 'studyDays' })
    expect(view.uri).toBe(`at://did:plc:me/space.opendeck.challenge/${view.rkey}`)
    expect([...airspace.challengeEntry.rows.values()][0]).toMatchObject({
      challenge: view.uri,
      days: [dayKey(new Date())],
    })
    expect(await useChallenges().get('did:plc:me', view.rkey)).toBe(view)
  })

  it('joins once and leaves', async () => {
    const airspace = signIn()
    const challenges = useChallenges()
    const view = await challenges.create({ title: 'C', kind: 'everyDay', weeks: 2 })
    const first = await challenges.join(view)
    const again = await challenges.join(view)
    expect(again.rkey).toBe(first.rkey)
    await challenges.leave(first)
    expect(airspace.challengeEntry.rows.size).toBe(0)
  })

  it('lists my challenges newest first', async () => {
    signIn()
    const challenges = useChallenges()
    const a = await challenges.create({ title: 'A', kind: 'studyDays', weeks: 1 })
    const mine = await challenges.mine()
    expect(mine.map((m) => m.challenge.rkey)).toEqual([a.rkey])
    expect(mine[0]!.entry.value.challenge).toBe(a.uri)
  })

  it('removes a challenge together with my entries', async () => {
    const airspace = signIn()
    const challenges = useChallenges()
    const view = await challenges.create({ title: 'A', kind: 'studyDays', weeks: 1 })
    await challenges.remove(view)
    expect(airspace.challenge.rows.size).toBe(0)
    expect(airspace.challengeEntry.rows.size).toBe(0)
  })

  it('reads a challenge of someone else by uri and ignores invalid ones', async () => {
    signIn()
    const remote = readAirspace('did:plc:host')
    const value = { title: 'T', kind: 'studyDays', ...challengeWindow(1), createdAt: new Date().toISOString() }
    vi.spyOn(remote.challenge, 'get').mockImplementation(async (rkey: string) =>
      rkey === 'ok' ? ({ value } as never) : rkey === 'bad' ? ({ value: {} } as never) : Promise.reject(new Error('x')),
    )
    const challenges = useChallenges()
    expect((await challenges.getByUri('at://did:plc:host/space.opendeck.challenge/ok'))?.value.title).toBe('T')
    expect(await challenges.getByUri('at://did:plc:host/space.opendeck.challenge/bad')).toBeNull()
    expect(await challenges.getByUri('at://did:plc:host/space.opendeck.challenge/err')).toBeNull()
  })

  it('collects participants from constellation, the host and me', async () => {
    signIn()
    const challenges = useChallenges()
    const view = await challenges.create({ title: 'A', kind: 'studyDays', weeks: 1 })
    linked.dids = ['did:plc:friend', 'did:plc:silent']
    const entry = (did: string) => [
      {
        uri: `at://${did}/space.opendeck.challengeEntry/e1`,
        rkey: 'e1',
        value: { challenge: view.uri, days: ['2026-06-01'] },
      },
    ]
    vi.spyOn(readAirspace('did:plc:me').challengeEntry, 'list').mockResolvedValue(entry('did:plc:me') as never)
    vi.spyOn(readAirspace('did:plc:friend').challengeEntry, 'list').mockResolvedValue(entry('did:plc:friend') as never)
    vi.spyOn(readAirspace('did:plc:silent').challengeEntry, 'list').mockRejectedValue(new Error('x'))
    const participants = await challenges.participants(view)
    expect(participants.map((p) => p.did).sort()).toEqual(['did:plc:friend', 'did:plc:me'])
    linked.dids = []
  })

  it('finds active challenges of people I follow', async () => {
    const airspace = signIn()
    airspace.follow.rows.set('f1', { subject: 'did:plc:friend' })
    const remote = readAirspace('did:plc:friend')
    const live = { title: 'Live', kind: 'studyDays', ...challengeWindow(1), createdAt: new Date().toISOString() }
    const past = { ...live, title: 'Past', startsAt: '2020-01-01T00:00:00Z', endsAt: '2020-01-08T00:00:00Z' }
    vi.spyOn(remote.challenge, 'list').mockResolvedValue([
      { rkey: 'a', value: live },
      { rkey: 'b', value: past },
      { rkey: 'c', value: {} },
    ] as never)
    expect((await useChallenges().fromFollows()).map((c) => c.value.title)).toEqual(['Live'])
  })

  it('syncs studied days into my entries only when they changed', async () => {
    const airspace = signIn()
    const challenges = useChallenges()
    const view = await challenges.create({ title: 'A', kind: 'studyDays', weeks: 1 })
    const today = dayKey(new Date())
    await challenges.sync({ [today]: 2 })
    expect(airspace.challengeEntry.put).toHaveBeenCalledTimes(1)
    expect(airspace.challengeEntry.put).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ days: [today], updatedAt: expect.any(String) }),
    )
    airspace.challengeEntry.put.mockClear()
    await challenges.sync({ [today]: 2 })
    expect(airspace.challengeEntry.put).not.toHaveBeenCalled()
    expect(view.uri).toBeTruthy()
  })

  it('does not sync without a session or when syncing fails', async () => {
    const challenges = useChallenges()
    await challenges.sync({})
    const airspace = signIn()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    airspace.challengeEntry.list.mockRejectedValue(new Error('x'))
    await challenges.sync({})
    expect(console.error).toHaveBeenCalled()
  })

  it('has no entries without a user', async () => {
    expect(
      await useChallenges()
        .mine()
        .catch(() => 'threw'),
    ).toBeDefined()
  })
})

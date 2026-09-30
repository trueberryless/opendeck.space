import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BattleGame, canBattle, ROUND_MS, type BattleCard, type PlayerProfile } from '~/utils/battle/game'

const cards: BattleCard[] = Array.from({ length: 12 }, (_, i) => ({
  front: `front ${i}`,
  back: `back ${i}`,
  frontReading: i === 0 ? 'fr' : ' ',
  backReading: `br ${i}`,
  hint: i === 1 ? 'hint' : undefined,
}))

const alice: PlayerProfile = { did: 'did:a', name: 'Alice', tier: 'bronze' }
const bob: PlayerProfile = { did: 'did:b', name: 'Bob', tier: 'gold' }

let clock = 0
let changes = 0

function newGame(deck = cards) {
  return new BattleGame(
    'deck',
    deck,
    () => changes++,
    () => clock,
  )
}

function correctChoice(game: BattleGame): number {
  const view = game.view()
  const options = view.question!.options
  const idx = cards.findIndex((c) => c.front === view.question!.prompt)
  return options.indexOf(cards[idx]!.back)
}

beforeEach(() => {
  vi.useFakeTimers()
  clock = 0
  changes = 0
})

afterEach(() => {
  vi.useRealTimers()
})

describe('canBattle', () => {
  it('needs four distinct answers', () => {
    expect(canBattle(cards)).toBe(true)
    expect(canBattle(cards.slice(0, 3))).toBe(false)
    expect(canBattle(cards.map((c) => ({ ...c, back: 'same' })))).toBe(false)
  })

  it('ignores blank and duplicate cards', () => {
    const dupes = [...cards.slice(0, 3), { front: ' ', back: 'x' }, { front: 'front 0', back: 'other' }]
    expect(canBattle(dupes)).toBe(false)
  })
})

describe('lobby', () => {
  it('seats players up to eight and lets known players rejoin', () => {
    const game = newGame()
    for (let i = 0; i < 8; i++) expect(game.join({ did: `d${i}`, name: `p${i}`, tier: null })).toBe(true)
    expect(game.join({ did: 'extra', name: 'x', tier: null })).toBe(false)
    expect(game.join({ did: 'd0', name: 'renamed', tier: null })).toBe(true)
    expect(game.players).toBe(8)
    expect(game.view().players[0]!.name).toBe('renamed')
  })

  it('does not start without enough cards', () => {
    expect(newGame(cards.slice(0, 2)).start()).toBe(false)
  })

  it('starts a ten question game and reports the lobby state before', () => {
    const game = newGame()
    expect(game.view()).toMatchObject({ phase: 'lobby', question: null, remainingMs: 0 })
    game.join(alice)
    expect(game.start()).toBe(true)
    expect(game.view()).toMatchObject({ phase: 'question', round: 0, rounds: 10, remainingMs: ROUND_MS })
    game.dispose()
  })

  it('toggles the handicap only outside a round', () => {
    const game = newGame()
    game.setHandicap(false)
    expect(game.view().handicap).toBe(false)
    game.join(alice)
    game.start()
    game.setHandicap(true)
    expect(game.view().handicap).toBe(false)
    game.dispose()
  })
})

describe('a round', () => {
  it('shows four options and hides the answer until the reveal', () => {
    const game = newGame()
    game.join(alice)
    game.start()
    const view = game.view()
    expect(view.question!.options).toHaveLength(4)
    expect(new Set(view.question!.options).size).toBe(4)
    expect(view.answer).toBeNull()
    game.dispose()
  })

  it('reveals once everyone answered and scores speed', () => {
    const game = newGame()
    game.join(alice)
    game.join({ ...bob, tier: 'bronze' })
    game.start()
    const right = correctChoice(game)
    clock = 0
    game.answer('did:a', 0, right, 0)
    expect(game.view().phase).toBe('question')
    expect(game.view().players[0]!.choice).toBeNull()
    game.answer('did:b', 0, (right + 1) % 4, 0)
    const view = game.view()
    expect(view.phase).toBe('reveal')
    expect(view.answer).toBe(right)
    expect(view.players.map((p) => p.gained)).toEqual([1000, 0])
    expect(view.players.map((p) => p.score)).toEqual([1000, 0])
    game.dispose()
  })

  it('awards fewer points for slower answers', () => {
    const game = newGame()
    game.join(alice)
    game.start()
    game.answer('did:a', 0, correctChoice(game), ROUND_MS)
    expect(game.view().players[0]!.gained).toBe(500)
    game.dispose()
  })

  it('ignores invalid, late and duplicate answers', () => {
    const game = newGame()
    game.join(alice)
    game.join(bob)
    game.start()
    game.answer('did:a', 1, 0, 0)
    game.answer('did:a', 0, 9, 0)
    game.answer('did:a', 0, 1.5, 0)
    game.answer('nobody', 0, 0, 0)
    expect(game.view().players.every((p) => !p.answered)).toBe(true)
    game.answer('did:a', 0, 0, 0)
    game.answer('did:a', 0, 1, 0)
    expect(game.view().players[0]!.answered).toBe(true)
    game.dispose()
  })

  it('treats a non-finite time as the slowest answer', () => {
    const game = newGame()
    game.join(alice)
    game.start()
    game.answer('did:a', 0, correctChoice(game), Number.NaN)
    expect(game.view().players[0]!.gained).toBe(500)
    game.dispose()
  })

  it('reveals when the timer runs out and moves on after the reveal', () => {
    const game = newGame()
    game.join(alice)
    game.start()
    vi.advanceTimersByTime(ROUND_MS)
    expect(game.view().phase).toBe('reveal')
    vi.advanceTimersByTime(4000)
    expect(game.view()).toMatchObject({ phase: 'question', round: 1 })
    game.dispose()
  })

  it('reveals early when the last unanswered player leaves', () => {
    const game = newGame()
    game.join(alice)
    game.join(bob)
    game.start()
    game.answer('did:a', 0, 0, 0)
    game.leave('did:b')
    expect(game.view().phase).toBe('reveal')
    game.leave('did:unknown')
    game.dispose()
  })

  it('reports remaining time from the clock', () => {
    const game = newGame()
    game.join(alice)
    game.start()
    clock = 5000
    expect(game.view().remainingMs).toBe(ROUND_MS - 5000)
    clock = 999999
    expect(game.view().remainingMs).toBe(0)
    game.dispose()
  })
})

describe('handicap', () => {
  it('boosts lower tiers by ten percent per rank, up to fifty percent', () => {
    const game = newGame()
    game.join(alice)
    game.join(bob)
    game.join({ did: 'did:c', name: 'C', tier: null })
    game.start()
    expect(game.view().players.map((p) => p.multiplier)).toEqual([1.2, 1, 1.2])
    game.dispose()
  })

  it('is disabled when switched off', () => {
    const game = newGame()
    game.setHandicap(false)
    game.join(alice)
    game.join(bob)
    game.start()
    expect(game.view().players.map((p) => p.multiplier)).toEqual([1, 1])
    game.dispose()
  })

  it('multiplies the points of the lower tier', () => {
    const game = newGame()
    game.join(alice)
    game.join(bob)
    game.start()
    const right = correctChoice(game)
    game.answer('did:a', 0, right, 0)
    game.answer('did:b', 0, right, 0)
    expect(game.view().players.map((p) => p.gained)).toEqual([1200, 1000])
    game.dispose()
  })
})

describe('a full game', () => {
  it('finishes after all questions and can restart with fresh scores', () => {
    const game = newGame()
    game.join(alice)
    game.start()
    for (let round = 0; round < 10; round++) {
      game.answer('did:a', round, correctChoice(game), 0)
      vi.advanceTimersByTime(4000)
    }
    expect(game.view()).toMatchObject({ phase: 'finished', question: null })
    expect(game.view().players[0]!.score).toBe(10_000)
    expect(changes).toBeGreaterThan(10)

    game.start()
    expect(game.view()).toMatchObject({ phase: 'question', round: 0 })
    expect(game.view().players[0]!.score).toBe(0)
    game.dispose()
  })

  it('keeps distinct readings for options', () => {
    const game = newGame()
    game.join(alice)
    game.start()
    const view = game.view()
    expect(view.question!.optionReadings).toHaveLength(4)
    game.dispose()
  })
})

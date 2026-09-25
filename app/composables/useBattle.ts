import { getBskyProfile } from '~/utils/bsky'
import { createKey, randomId } from '~/utils/battle/crypto'
import {
  BattleGame,
  ROUND_MS,
  type BattleCard,
  type BattleView,
  type GuestMessage,
  type HostMessage,
  type PlayerProfile,
} from '~/utils/battle/game'
import { acceptGuests, connectToHost, link, type Link, type Peer } from '~/utils/battle/peer'

export type BattleRole = 'host' | 'guest'
export type BattleStatus = 'idle' | 'connecting' | 'connected' | 'full' | 'failed' | 'closed'

export interface BattleState {
  role: BattleRole | null
  id: string | null
  hostDid: string | null
  key: string | null
  status: BattleStatus
  view: BattleView | null
  viewAt: number
  choice: number | null
}

const IDLE: BattleState = {
  role: null,
  id: null,
  hostDid: null,
  key: null,
  status: 'idle',
  view: null,
  viewAt: 0,
  choice: null,
}

let game: BattleGame | null = null
let stopAccepting: (() => void) | null = null
const guests = new Map<string, Link<HostMessage>>()
let host: Link<GuestMessage> | null = null

export function useBattle() {
  const state = useState<BattleState>('opendeck-battle', () => ({ ...IDLE }))
  const me = useMe()
  const authUser = useAuthUser()
  const motivation = useMotivation()

  const myTier = () => (motivation.enabled.value ? (motivation.summary.value?.tier ?? null) : null)

  function show(view: BattleView) {
    const { round, phase } = state.value.view ?? {}
    const newQuestion = view.phase === 'question' && (phase !== 'question' || round !== view.round)
    state.value = { ...state.value, view, viewAt: performance.now(), choice: newQuestion ? null : state.value.choice }
  }

  function broadcast() {
    if (!game) return
    const view = game.view()
    show(view)
    for (const guest of guests.values()) guest.send({ type: 'view', view })
  }

  async function welcome(peer: Peer, tier: PlayerProfile['tier'], guest: Link<HostMessage>) {
    const profile = await getBskyProfile(peer.did).catch(() => null)
    const seated = game?.join({
      did: peer.did,
      name: profile?.displayName || profile?.handle || peer.did,
      avatar: profile?.avatar,
      tier,
    })
    if (seated) return
    guest.send({ type: 'full' })
    guest.close()
  }

  function seat(peer: Peer) {
    guests.get(peer.did)?.close()
    const guest = link<GuestMessage, HostMessage>(
      peer,
      (message) => {
        if (message.type === 'hello') void welcome(peer, message.tier, guest)
        else if (message.type === 'answer') game?.answer(peer.did, message.round, message.choice, message.ms)
      },
      () => {
        if (guests.get(peer.did) !== guest) return
        guests.delete(peer.did)
        game?.leave(peer.did)
      },
    )
    guests.set(peer.did, guest)
  }

  function hostBattle(deck: string, cards: BattleCard[]): { id: string; key: string } {
    const did = authUser.value!.did
    leave()
    const id = randomId()
    const key = createKey()
    state.value = { ...IDLE, role: 'host', id, key, hostDid: did, status: 'connected' }
    game = new BattleGame(deck, cards, broadcast)
    game.join({
      did,
      name: me.value?.displayName || me.value?.handle || authUser.value?.handle || did,
      avatar: me.value?.avatar,
      tier: myTier(),
    })
    stopAccepting = acceptGuests(did, id, key, seat)
    return { id, key }
  }

  async function join(hostDid: string, id: string, key: string) {
    leave()
    state.value = { ...IDLE, role: 'guest', id, key, hostDid, status: 'connecting' }
    try {
      const peer = await connectToHost(hostDid, id, key)
      if (state.value.id !== id) return peer.pc.close()
      host = link<HostMessage, GuestMessage>(
        peer,
        (message) => {
          if (message.type === 'view') show(message.view)
          else state.value = { ...state.value, status: message.type === 'full' ? 'full' : 'closed' }
        },
        () => {
          host = null
          if (state.value.id === id && state.value.status === 'connected') state.value.status = 'closed'
        },
      )
      state.value = { ...state.value, status: 'connected' }
      host.send({ type: 'hello', tier: myTier() })
    } catch (err) {
      console.error('[opendeck] could not join the battle', err)
      if (state.value.id === id) state.value = { ...state.value, status: 'failed' }
      throw err
    }
  }

  function answer(choice: number) {
    const { view, viewAt, choice: current } = state.value
    if (!view || view.phase !== 'question' || current !== null) return
    const ms = ROUND_MS - view.remainingMs + (performance.now() - viewAt)
    state.value = { ...state.value, choice }
    const did = authUser.value?.did
    if (game && did) game.answer(did, view.round, choice, ms)
    else host?.send({ type: 'answer', round: view.round, choice, ms })
  }

  function start(): boolean {
    return game?.start() ?? false
  }

  function setHandicap(on: boolean) {
    game?.setHandicap(on)
  }

  function leave() {
    stopAccepting?.()
    stopAccepting = null
    for (const guest of guests.values()) {
      guest.send({ type: 'closed' })
      guest.close()
    }
    guests.clear()
    game?.dispose()
    game = null
    host?.close()
    host = null
    state.value = { ...IDLE }
  }

  return { state, hostBattle, join, answer, start, setHandicap, leave }
}

import { normalizeSession, type ProgressValue, type SessionValue } from '~/utils/records'
import { computeStats, type StudyStats } from '~/utils/stats'

export async function computeStudyStats(): Promise<{ stats: StudyStats; sessions: SessionValue[] }> {
  const decks = useDecks()
  const [myDecks, map, sessions] = await Promise.all([
    decks.listMyDecks(),
    useStudy().loadProgressMap(),
    loadSessions(),
  ])
  const frontByUri = new Map<string, string>()
  for (const cards of (await decks.listAllMyCards(myDecks)).values()) {
    for (const c of cards) frontByUri.set(c.uri, c.value.front)
  }
  const progresses: ProgressValue[] = [...map.values()].map((r) => r.value)
  return { stats: computeStats(progresses, sessions, frontByUri), sessions }
}

export function useStats() {
  const stats = useState<StudyStats | null>('opendeck-stats', () => null)
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      const result = await computeStudyStats()
      stats.value = result.stats
      useMotivation().apply(result.stats.activity, result.sessions)
    } catch (err) {
      console.error('[opendeck] failed to compute stats', err)
      stats.value = null
    } finally {
      loading.value = false
    }
  }

  return { stats, loading, load }
}

export async function loadSessions(): Promise<SessionValue[]> {
  const sync = useSync()
  const airspace = onlineAirspace()
  let byRkey: Map<string, SessionValue> | null = null

  if (airspace) {
    try {
      const fetched = new Map<string, SessionValue>()
      for (const r of await airspace.session.list()) fetched.set(r.rkey, normalizeSession(r.value))
      if (await useSpacesSupport().ensure()) {
        for (const r of await airspace.vault.session.list()) fetched.set(r.rkey, normalizeSession(r.value))
      }
      await sync.cacheSessions(fetched)
      byRkey = fetched
    } catch (err) {
      console.error('[opendeck] falling back to cached study sessions', err)
    }
  }

  byRkey ??= await sync.getCachedSessions()
  for (const q of await sync.getQueuedSessions()) byRkey.set(q.rkey, normalizeSession(q.value))
  return [...byRkey.values()]
}

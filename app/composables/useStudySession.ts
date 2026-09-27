import type { RatingKey, StudyDirection } from '~/utils/records'
import type { OutboxSession } from '~/utils/db'
import { nextTid } from '~/utils/tid'

const MAX_CARD_MS = 2 * 60 * 1000

export function useStudySession() {
  const sync = useSync()
  let current: OutboxSession | null = null
  let activeMs = 0
  let cardShownAt = Date.now()
  const activeSeconds = ref(0)

  function cardShown() {
    cardShownAt = Date.now()
  }

  async function record(entry: { deck?: string; direction: StudyDirection; rating: RatingKey; isNew: boolean }) {
    const now = Date.now()
    const spent = Math.min(now - cardShownAt, MAX_CARD_MS)
    cardShownAt = now

    if (!current) {
      current = {
        rkey: nextTid(),
        open: true,
        value: {
          deck: entry.deck || undefined,
          direction: entry.direction === 'reverse' ? 'reverse' : undefined,
          startedAt: new Date(now - spent).toISOString(),
          endedAt: new Date(now).toISOString(),
          activeSeconds: 0,
          repetitions: 0,
          again: 0,
          hard: 0,
          good: 0,
          easy: 0,
          newCards: 0,
        },
      }
      activeMs = 0
      await sync.closeSessionDrafts(current.rkey)
    }

    activeMs += spent
    const v = current.value
    v.repetitions++
    v[entry.rating]++
    if (entry.isNew) v.newCards++
    v.endedAt = new Date(now).toISOString()
    v.activeSeconds = Math.round(activeMs / 1000)
    activeSeconds.value = v.activeSeconds
    await sync.saveSessionDraft(current)
  }

  async function finish() {
    if (!current) return
    const done = { ...current, open: false }
    current = null
    activeSeconds.value = 0
    await sync.saveSessionDraft(done)
    if (sync.online.value) void sync.flush()
  }

  return { cardShown, record, finish, activeSeconds }
}

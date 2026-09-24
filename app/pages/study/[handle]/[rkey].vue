<script setup lang="ts">
import type { ReadingMode, StudyDirection } from '~/utils/records'
import type { CardView, DeckView } from '~/composables/useDecks'
import type { ProgressRecord, StudyItem } from '~/composables/useStudy'
import type { Grade } from 'ts-fsrs'
import { useI18n } from 'vue-i18n'
import { resolveDid } from '~/utils/bsky'
import {
  directionKey,
  formatShortTerm,
  intervalPreview,
  RATINGS,
  resolveShortTermPreset,
  SHORT_TERM_PRESET_KEYS,
  type ShortTermChoice,
} from '~/utils/fsrs'

definePageMeta({ middleware: 'auth', fill: true, inlineSync: true })

const { t } = useI18n()
const route = useRoute()
const authUser = useAuthUser()
const decks = useDecks()
const study = useStudy()
const session = useStudySession()

const handle = computed(() => route.params.handle as string)
const rkey = computed(() => route.params.rkey as string)

const loading = ref(true)
const notFound = ref(false)
const deckTitle = ref('')
const deckUri = ref('')
const authorDid = ref('')
const queue = ref<StudyItem[]>([])
const learning = ref<StudyItem[]>([])
const current = ref<StudyItem | null>(null)
const cardKey = ref(0)
const revealed = ref(false)
const showHint = ref(false)
const direction = ref<StudyDirection>(route.query.dir === 'reverse' ? 'reverse' : 'forward')
const repetitions = ref(0)
const total = computed(() => repetitions.value + queue.value.length + learning.value.length + (current.value ? 1 : 0))

const allCards = ref<CardView[]>([])
const progressMap = ref<Map<string, ProgressRecord>>(new Map())
const readingMode = ref<ReadingMode>('answer')

const reversed = computed(() => direction.value === 'reverse')

const promptReading = computed(() => {
  const c = current.value?.card.value
  return c ? (reversed.value ? c.backReading : c.frontReading) : undefined
})
const answerReading = computed(() => {
  const c = current.value?.card.value
  return c ? (reversed.value ? c.frontReading : c.backReading) : undefined
})
const { prefs } = useProfile()
const deckView = ref<DeckView | null>(null)
const sessionSize = ref(0)
const intervalChoice = computed<ShortTermChoice>(
  () => deckView.value?.value.shortTermIntervals ?? prefs.value?.shortTermIntervals ?? 'auto',
)
const intervalPreset = computed(() => resolveShortTermPreset(intervalChoice.value, sessionSize.value))

async function setIntervalChoice(choice: ShortTermChoice) {
  const view = deckView.value
  if (!view || choice === intervalChoice.value) return
  const previous = view.value
  const value = { ...previous, shortTermIntervals: choice }
  deckView.value = { ...view, value }
  try {
    await decks.updateDeck(view.rkey, value, view.visibility)
  } catch (err) {
    deckView.value = { ...view, value: previous }
    useToast().add({ title: t('deck.toast.saveDeckError'), description: String(err), color: 'error' })
  }
}

const optionItems = computed(() => [
  [
    { type: 'label' as const, label: t('deckEditor.readingMode') },
    ...(['answer', 'prompt', 'hint', 'off'] as ReadingMode[]).map((m) => ({
      label: t(`deckEditor.reading.${m}`),
      type: 'checkbox' as const,
      checked: m === readingMode.value,
      onSelect: () => (readingMode.value = m),
    })),
  ],
  [
    { type: 'label' as const, label: t('shortTerm.title') },
    {
      label: t('shortTerm.autoActive', {
        preset: t(`shortTerm.presets.${resolveShortTermPreset('auto', sessionSize.value)}`),
      }),
      type: 'checkbox' as const,
      checked: intervalChoice.value === 'auto',
      disabled: !deckView.value,
      onSelect: () => setIntervalChoice('auto'),
    },
    ...SHORT_TERM_PRESET_KEYS.map((p) => ({
      label: `${t(`shortTerm.presets.${p}`)} · ${formatShortTerm(p)}`,
      type: 'checkbox' as const,
      checked: intervalChoice.value === p,
      disabled: !deckView.value,
      onSelect: () => setIntervalChoice(p),
    })),
  ],
])

const shownFront = computed(
  () => (reversed.value ? current.value?.card.value.back : current.value?.card.value.front) ?? '',
)
const shownBack = computed(
  () => (reversed.value ? current.value?.card.value.front : current.value?.card.value.back) ?? '',
)

const LEARN_AHEAD_MS = 20 * 60 * 1000

function dueAt(item: StudyItem): number {
  return item.progress ? new Date(item.progress.dueAt).getTime() : 0
}

function pickNext(): StudyItem | null {
  const now = Date.now()
  learning.value.sort((a, b) => dueAt(a) - dueAt(b))
  const soonest = learning.value[0]
  if (soonest && dueAt(soonest) <= now) return learning.value.shift() ?? null
  if (queue.value.length > 0) return queue.value.shift() ?? null
  if (soonest && dueAt(soonest) - now <= LEARN_AHEAD_MS) return learning.value.shift() ?? null
  return null
}

function advance() {
  current.value = pickNext()
  cardKey.value++
  revealed.value = false
  showHint.value = false
  session.cardShown()
}

function rebuildQueue() {
  queue.value = study.buildQueue(allCards.value, progressMap.value, direction.value, true)
  sessionSize.value = queue.value.length
  learning.value = []
  repetitions.value = 0
  advance()
}

function toggleDirection() {
  void session.finish()
  direction.value = reversed.value ? 'forward' : 'reverse'
  rebuildQueue()
}
const done = computed(() => !loading.value && !notFound.value && !current.value)
const preview = computed(() => (current.value ? intervalPreview(current.value.progress, intervalPreset.value) : null))

useHead(() => ({
  title: deckTitle.value ? `${t('study.title')} ${deckTitle.value} · OpenDeck` : `${t('study.title')} · OpenDeck`,
}))

onMounted(async () => {
  const sync = useSync()
  try {
    const did = await resolveDid(handle.value)
    if (!did) return void (notFound.value = true)

    if (authUser.value?.did !== did)
      return void (await navigateTo(deckPath(handle.value, rkey.value), { replace: true }))
    authorDid.value = did
    deckUri.value = `at://${did}/space.opendeck.deck/${rkey.value}`

    let cards: CardView[]
    if (sync.online.value) {
      const deck = await decks.getMyDeck(rkey.value)
      if (!deck) return void (notFound.value = true)
      deckView.value = deck
      deckTitle.value = deck.value.title
      deckUri.value = deck.uri
      readingMode.value = deck.value.readingMode ?? 'answer'
      cards = await decks.listMyCards(rkey.value, deck.visibility)
      await sync.cacheCards(deck.uri, cards)
    } else {
      cards = await sync.getCachedCards(deckUri.value)
      if (cards.length === 0) return void (notFound.value = true)
    }

    const map = await study.loadProgressMap()
    allCards.value = cards
    progressMap.value = map
    rebuildQueue()
  } catch (err) {
    console.error(err)
    notFound.value = true
  } finally {
    loading.value = false
  }
})

function reveal() {
  revealed.value = true
}

function grade(g: Grade) {
  const item = current.value
  if (!item) return
  const isNew = !item.progress || item.progress.state === 'new'
  const saved = study.grade(item, g, intervalPreset.value)
  const next = item.progress
  if (next && item.progressRkey)
    progressMap.value.set(directionKey(item.card.uri, item.direction), { rkey: item.progressRkey, value: next })
  if (next && next.state !== 'review' && dueAt(item) - Date.now() <= LEARN_AHEAD_MS) learning.value.push(item)
  repetitions.value++
  advance()

  saved.catch((err) => {
    console.error(err)
    useToast().add({ title: t('study.saveProgressError'), description: String(err), color: 'error' })
  })
  const rating = RATINGS.find((r) => r.grade === g)
  if (rating) {
    session
      .record({ deck: rkey.value, direction: item.direction, rating: rating.key, isNew })
      .catch((err) => console.error('[opendeck] failed to record study session', err))
  }
}

type SwipeDir = 'left' | 'right' | 'up' | 'down'
const SWIPE_THRESHOLD = 80
const DRAG_SLOP = 8
const SWIPE_GRADES: Record<SwipeDir, Grade> = {
  left: RATINGS[0].grade,
  down: RATINGS[1].grade,
  right: RATINGS[2].grade,
  up: RATINGS[3].grade,
}

const drag = reactive({ pointer: -1, startX: 0, startY: 0, x: 0, y: 0, moved: false })
let suppressClick = false

const swipeDir = computed<SwipeDir | null>(() => {
  const { x, y } = drag
  if (Math.max(Math.abs(x), Math.abs(y)) < SWIPE_THRESHOLD) return null
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left'
  return y > 0 ? 'down' : 'up'
})
const swipeRating = computed(() =>
  swipeDir.value ? RATINGS.find((r) => r.grade === SWIPE_GRADES[swipeDir.value!]) : undefined,
)
const cardStyle = computed(() =>
  drag.moved ? { transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 25}deg)` } : undefined,
)

function onPointerDown(e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  if ((e.target as HTMLElement).closest('button, a, audio, video, input')) return
  Object.assign(drag, { pointer: e.pointerId, startX: e.clientX, startY: e.clientY, x: 0, y: 0, moved: false })
}

function onPointerMove(e: PointerEvent) {
  if (e.pointerId !== drag.pointer) return
  drag.x = e.clientX - drag.startX
  drag.y = e.clientY - drag.startY
  if (!drag.moved && Math.hypot(drag.x, drag.y) > DRAG_SLOP) {
    drag.moved = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
}

function onPointerUp(e: PointerEvent) {
  if (e.pointerId !== drag.pointer) return
  const dir = e.type === 'pointerup' ? swipeDir.value : null
  const moved = drag.moved
  Object.assign(drag, { pointer: -1, x: 0, y: 0, moved: false })
  if (!moved) return
  suppressClick = true
  setTimeout(() => (suppressClick = false))
  if (dir) grade(SWIPE_GRADES[dir])
}

function onCardClick() {
  if (!suppressClick) reveal()
}

const optionsOpen = ref(false)
const revealButton = useTemplateRef<{ $el: HTMLElement }>('revealButton')
const ratingButtons = useTemplateRef<{ $el: HTMLElement }[]>('ratingButtons')
const ARROW_KEYS = ['arrowleft', 'arrowdown', 'arrowright', 'arrowup']
const hasHint = computed(() =>
  Boolean(current.value?.card.value.hint || (readingMode.value === 'hint' && promptReading.value)),
)

watch([revealed, cardKey, showHint], async () => {
  await nextTick()
  const active = document.activeElement
  if (!current.value || (active && active !== document.body)) return
  const el = revealed.value ? ratingButtons.value?.[2]?.$el : revealButton.value?.$el
  el?.focus({ preventScroll: true })
})

const announcement = computed(() => {
  if (!current.value) return ''
  if (revealed.value) return t('a11y.answerAnnouncement', { answer: shownBack.value })
  return t('a11y.cardAnnouncement', { current: repetitions.value + 1, total: total.value, front: shownFront.value })
})

useShortcuts(
  'study',
  () => t('shortcuts.groups.study'),
  () => [
    {
      keys: ['space', 'enter'],
      label: t('study.reveal'),
      run: reveal,
      when: () => Boolean(current.value) && !revealed.value,
    },
    ...RATINGS.map((r, i) => ({
      keys: [String(i + 1), ARROW_KEYS[i]!],
      label: t(`study.ratings.${r.key}`),
      run: () => grade(r.grade),
      when: () => Boolean(current.value) && revealed.value,
      onInteractive: true,
    })),
    {
      keys: ['space', 'enter'],
      label: t(`study.ratings.${RATINGS[2].key}`),
      run: () => grade(RATINGS[2].grade),
      when: () => Boolean(current.value) && revealed.value,
    },
    {
      keys: ['h'],
      label: t('study.showHint'),
      run: () => (showHint.value = true),
      when: () => Boolean(current.value) && !revealed.value && !showHint.value && hasHint.value,
    },
    { keys: ['r'], label: t('study.flipTitle'), run: toggleDirection, when: () => !loading.value && !notFound.value },
    { keys: ['o'], label: t('study.options'), run: () => (optionsOpen.value = true) },
    { keys: ['b'], label: t('study.backToDeck'), run: () => navigateTo(deckPath(handle.value, rkey.value)) },
  ],
)

onBeforeUnmount(() => {
  void session.finish()
})
watch(done, (isDone) => {
  if (isDone) void session.finish()
})
</script>

<template>
  <div class="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6">
    <div class="flex items-center gap-3">
      <UButton
        :to="deckPath(handle, rkey)"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="$t('study.backToDeckAria')"
      />
      <div class="min-w-0 flex-1">
        <h1 class="truncate font-semibold">{{ deckTitle || $t('study.title') }}</h1>
        <UProgress v-if="total > 0" :model-value="repetitions" :max="total" size="sm" class="mt-1" aria-hidden="true" />
      </div>
      <UDropdownMenu v-model:open="optionsOpen" :items="optionItems" :content="{ align: 'end' }">
        <UButton
          icon="i-lucide-settings-2"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="$t('study.options')"
          :title="$t('study.options')"
          aria-keyshortcuts="O"
        />
      </UDropdownMenu>
      <UButton
        icon="i-lucide-arrow-left-right"
        :color="reversed ? 'primary' : 'neutral'"
        :variant="reversed ? 'soft' : 'ghost'"
        size="sm"
        :aria-label="reversed ? $t('study.showingBack') : $t('study.showingFront')"
        :title="$t('study.flipTitle')"
        :aria-pressed="reversed"
        aria-keyshortcuts="R"
        @click="toggleDirection"
      />
      <span v-if="total > 0" class="text-muted text-sm tabular-nums">
        <span class="sr-only">{{ $t('a11y.sessionProgress') }}:</span>
        {{ repetitions }}/{{ total }}
      </span>
      <StudySyncStatus />
    </div>

    <div class="flex flex-1 flex-col justify-center gap-6">
      <div v-if="loading" class="space-y-4">
        <USkeleton class="h-64 w-full rounded-2xl" />
      </div>

      <UAlert
        v-else-if="notFound"
        icon="i-lucide-search-x"
        :title="$t('study.deckNotFound')"
        :description="$t('study.deckNotFoundBody')"
        color="neutral"
        variant="subtle"
      />

      <div v-else-if="done" class="border-default rounded-2xl border border-dashed p-10 text-center">
        <UIcon name="i-lucide-party-popper" class="text-accent mx-auto size-10" />
        <p class="mt-3 text-lg font-semibold">
          {{ total > 0 ? $t('study.sessionComplete') : $t('study.nothingDue') }}
        </p>
        <p class="text-muted mt-1 text-sm">
          {{ total > 0 ? $t('study.repetitionsDone', { count: repetitions }, repetitions) : $t('study.comeBackLater') }}
        </p>
        <div class="mt-4 flex justify-center gap-3">
          <UButton :to="deckPath(handle, rkey)" :label="$t('study.backToDeck')" color="neutral" variant="subtle" />
          <UButton to="/study" :label="$t('study.studyOverview')" icon="i-lucide-graduation-cap" />
        </div>
      </div>
      <template v-else-if="current">
        <p class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
        <div
          :key="cardKey"
          class="relative touch-none"
          :class="drag.pointer === -1 ? 'transition-transform duration-200 ease-out' : ''"
          :style="cardStyle"
          @click="onCardClick"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <StudyCard
            :front="shownFront"
            :back="shownBack"
            :hint="current.card.value.hint"
            :prompt-reading="promptReading"
            :answer-reading="answerReading"
            :reading-mode="readingMode"
            :examples="current.card.value.examples"
            :front-lang="reversed ? deckView?.value.targetLang : deckView?.value.sourceLang"
            :back-lang="reversed ? deckView?.value.sourceLang : deckView?.value.targetLang"
            :did="authorDid"
            :image="current.card.value.image"
            :image-alt="current.card.value.imageAlt"
            :audio="current.card.value.audio"
            :show-hint="showHint"
            :revealed="revealed"
            @reveal-hint="showHint = true"
          />
          <div
            v-if="swipeRating"
            class="pointer-events-none absolute inset-x-0 top-4 flex justify-center"
            aria-hidden="true"
          >
            <UBadge :color="swipeRating.color" :icon="swipeRating.icon" size="lg" variant="solid">
              {{ $t(`study.ratings.${swipeRating.key}`) }}
            </UBadge>
          </div>
        </div>

        <div v-if="!revealed" class="text-center">
          <UButton
            ref="revealButton"
            :label="$t('study.reveal')"
            icon="i-lucide-eye"
            size="lg"
            variant="subtle"
            aria-keyshortcuts="Space Enter"
            @click="reveal"
          />
        </div>

        <div v-else class="grid grid-cols-4 gap-2">
          <UButton
            v-for="(r, i) in RATINGS"
            ref="ratingButtons"
            :key="r.key"
            :aria-keyshortcuts="`${i + 1} ${['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'][i]}`"
            :color="r.color"
            :variant="swipeRating?.key === r.key ? 'solid' : 'subtle'"
            class="flex-col py-2"
            @click="grade(r.grade)"
          >
            <span class="font-medium">{{ $t(`study.ratings.${r.key}`) }}</span>
            <span class="text-xs">{{ preview?.[r.key] }}</span>
            <kbd class="mt-0.5 font-sans text-[10px]" aria-hidden="true">{{ i + 1 }}</kbd>
          </UButton>
        </div>
      </template>
    </div>
  </div>
</template>

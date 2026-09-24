<script setup lang="ts">
import type { ProgressState, StudyDirection, Visibility } from '~/utils/records'
import { authReady } from '~/composables/useAirspace'
import type { CardFormData } from '~/components/CardEditor.vue'
import type { CardListLayout, StateColor } from '~/components/DeckCardList.vue'
import type { DeckFormData } from '~/components/DeckEditor.vue'
import type { CardView, DeckView } from '~/composables/useDecks'
import type { ProgressRecord } from '~/composables/useStudy'
import { useI18n } from 'vue-i18n'
import { getBskyProfile, resolveDid, type BskyProfile } from '~/utils/bsky'
import { directionKey, isDue } from '~/utils/fsrs'

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const authUser = useAuthUser()
const isLoggedIn = useIsLoggedIn()
const { prefs } = useProfile()
const decks = useDecks()
const study = useStudy()

const handle = computed(() => route.params.handle as string)
const rkey = computed(() => route.params.rkey as string)

const deck = ref<DeckView | null>(null)
const cards = ref<CardView[]>([])
const owner = ref<BskyProfile | null>(null)
const progressMap = ref<Map<string, ProgressRecord>>(new Map())
const myCopy = ref<DeckView | null>(null)
const loading = ref(true)
const notFound = ref(false)

const isOwner = computed(() => Boolean(deck.value && authUser.value?.did === deck.value.author))

useHead(() => ({ title: deck.value ? `${deck.value.value.title} · OpenDeck` : 'Deck · OpenDeck' }))

async function load() {
  loading.value = true
  await authReady
  notFound.value = false
  deck.value = null
  cards.value = []
  myCopy.value = null
  progressMap.value = new Map()
  try {
    const did = await resolveDid(handle.value)
    if (!did) return void (notFound.value = true)
    owner.value = await getBskyProfile(did)

    if (authUser.value?.did === did) {
      deck.value = await decks.getMyDeck(rkey.value)
      if (deck.value) cards.value = await decks.listMyCards(rkey.value, deck.value.visibility)
    } else {
      deck.value = await decks.getForeignDeck(did, rkey.value)
      if (deck.value) cards.value = await decks.listForeignCards(did, deck.value.rkey)
    }
    if (!deck.value) return void (notFound.value = true)

    if (isOwner.value) progressMap.value = await study.loadProgressMap().catch(() => new Map())
    else if (authUser.value) myCopy.value = await decks.findCopyOf(deck.value.uri).catch(() => null)
  } catch (err) {
    console.error(err)
    notFound.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch([handle, rkey], load)

const direction = ref<StudyDirection>('forward')
const reversed = computed(() => direction.value === 'reverse')
const srcLang = computed(() => deck.value?.value.sourceLang)
const tgtLang = computed(() => deck.value?.value.targetLang)
const canSwap = computed(() => Boolean(srcLang.value && tgtLang.value))
const shownFrom = computed(() => (reversed.value ? tgtLang.value : srcLang.value))
const shownTo = computed(() => (reversed.value ? srcLang.value : tgtLang.value))
const langs = computed(() => {
  if (srcLang.value && tgtLang.value) return null
  return tgtLang.value || srcLang.value || null
})

function toggleDirection() {
  if (canSwap.value) direction.value = reversed.value ? 'forward' : 'reverse'
}

const myCopyTo = computed(() =>
  myCopy.value ? deckPath(authUser.value?.handle || authUser.value?.did || '', myCopy.value.rkey) : '',
)

const studyTo = computed(() => studyPath(handle.value, rkey.value) + (reversed.value ? '?dir=reverse' : ''))

function stateOf(card: CardView): ProgressState {
  return progressMap.value.get(directionKey(card.uri, direction.value))?.value.state ?? 'new'
}
function isDueCard(card: CardView): boolean {
  return isDue(progressMap.value.get(directionKey(card.uri, direction.value))?.value ?? null)
}
const STATE_META = computed<Record<ProgressState, { label: string; color: StateColor }>>(() => ({
  new: { label: t('deck.states.new'), color: 'neutral' },
  learning: { label: t('deck.states.learning'), color: 'warning' },
  review: { label: t('deck.states.review'), color: 'success' },
  relearning: { label: t('deck.states.relearning'), color: 'error' },
}))

type DeckViewMode = 'list' | 'dense' | 'grid' | 'grouped'
const view = useLocalStorage<DeckViewMode>('opendeck-deck-view', 'list')
const wide = useMediaQuery('(min-width: 640px)')
const shownView = computed<DeckViewMode>(() => (view.value === 'grid' && !wide.value ? 'dense' : view.value))
const listLayout = computed<CardListLayout>(() => (shownView.value === 'grouped' ? 'list' : shownView.value))
type FilterValue = 'all' | 'due' | ProgressState
const filterState = ref<FilterValue>('all')
const visibleFilters = computed<{ value: FilterValue; label: string }[]>(() => {
  if (cards.value.length === 0) return []
  const out: { value: FilterValue; label: string }[] = [{ value: 'all', label: t('deck.filters.all') }]
  if (cards.value.some((c) => isDueCard(c))) out.push({ value: 'due', label: t('deck.filters.due') })
  for (const state of ['new', 'learning', 'review'] as ProgressState[]) {
    if (cards.value.some((c) => stateOf(c) === state)) out.push({ value: state, label: t(`deck.states.${state}`) })
  }
  return out
})

watch([visibleFilters, filterState], () => {
  if (!visibleFilters.value.some((f) => f.value === filterState.value)) filterState.value = 'all'
})

const filtered = computed(() =>
  cards.value.filter((c) => {
    if (filterState.value === 'all') return true
    if (filterState.value === 'due') return isDueCard(c)
    return stateOf(c) === filterState.value
  }),
)
const grouped = computed(() =>
  (['review', 'learning', 'relearning', 'new'] as ProgressState[])
    .map((state) => ({ state, cards: filtered.value.filter((c) => stateOf(c) === state) }))
    .filter((g) => g.cards.length > 0),
)

const cardModalOpen = ref(false)
const editingCard = ref<CardView | null>(null)
const savingCard = ref(false)

function openAddCard() {
  editingCard.value = null
  cardModalOpen.value = true
}
function openEditCard(card: CardView) {
  editingCard.value = card
  cardModalOpen.value = true
}

async function saveCard(data: CardFormData) {
  if (!deck.value) return
  savingCard.value = true
  try {
    if (editingCard.value) {
      await decks.updateCard(editingCard.value.rkey, { ...editingCard.value.value, ...data }, deck.value.visibility)
    } else {
      await decks.createCard(deck.value.rkey, { ...data, order: cards.value.length }, deck.value.visibility)
    }
    cardModalOpen.value = false
    cards.value = await decks.listMyCards(rkey.value, deck.value.visibility)
  } catch (err) {
    toast.add({ title: t('deck.toast.saveCardError'), description: String(err), color: 'error' })
  } finally {
    savingCard.value = false
  }
}

async function deleteCard(card: CardView) {
  if (!deck.value) return
  try {
    await decks.deleteCard(card.rkey, deck.value.visibility)
    cards.value = cards.value.filter((c) => c.rkey !== card.rkey)
    await study
      .resetProgress([card.uri])
      .catch((err) => console.error('[opendeck] failed to delete progress of a deleted card', err))
  } catch (err) {
    toast.add({ title: t('deck.toast.deleteCardError'), description: String(err), color: 'error' })
  }
}

const deckModalOpen = ref(false)
const savingDeck = ref(false)
async function saveDeck(data: DeckFormData) {
  if (!deck.value) return
  savingDeck.value = true
  try {
    const value = {
      ...deck.value.value,
      title: data.title,
      summary: data.summary,
      sourceLang: data.sourceLang,
      targetLang: data.targetLang,
      readingMode: data.readingMode,
      shortTermIntervals: data.shortTermIntervals,
      tags: data.tags,
    }
    await decks.updateDeck(deck.value.rkey, value, deck.value.visibility)
    deck.value = { ...deck.value, value }
    deckModalOpen.value = false
  } catch (err) {
    toast.add({ title: t('deck.toast.saveDeckError'), description: String(err), color: 'error' })
  } finally {
    savingDeck.value = false
  }
}

const deleting = ref(false)
async function deleteDeck() {
  if (!deck.value || deleting.value) return
  deleting.value = true
  try {
    const cardUris = cards.value.map((c) => c.uri)
    await decks.deleteDeck(deck.value.rkey, deck.value.visibility)
    await study
      .resetProgress(cardUris)
      .catch((err) => console.error('[opendeck] failed to delete progress of a deleted deck', err))
    toast.add({ title: t('deck.toast.deckDeleted'), color: 'success' })
    await navigateTo('/')
  } catch (err) {
    toast.add({ title: t('deck.toast.deleteDeckError'), description: String(err), color: 'error' })
    deleting.value = false
  }
}

const resetting = ref(false)
async function resetProgress() {
  resetting.value = true
  try {
    await study.resetProgress(cards.value.map((c) => c.uri))
    progressMap.value = await study.loadProgressMap().catch(() => new Map())
    toast.add({ title: t('deck.toast.progressReset'), color: 'success' })
  } catch (err) {
    toast.add({ title: t('deck.toast.resetError'), description: String(err), color: 'error' })
  } finally {
    resetting.value = false
  }
}

const { exportDecks, download } = useExport()
const exporting = ref(false)
async function exportThisDeck() {
  if (!deck.value) return
  exporting.value = true
  try {
    const data = await exportDecks([deck.value], true)
    const slug = deck.value.value.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'deck'
    download(data, `${slug}.json`)
  } catch (err) {
    toast.add({ title: t('deck.toast.exportError'), description: String(err), color: 'error' })
  } finally {
    exporting.value = false
  }
}

const VIEW_ORDER: DeckViewMode[] = ['list', 'dense', 'grid', 'grouped']
function cycleView() {
  const order = VIEW_ORDER.filter((v) => v !== 'grid' || wide.value)
  view.value = order[(order.indexOf(shownView.value) + 1) % order.length]!
}
function cycleFilter() {
  const filters = visibleFilters.value
  if (filters.length === 0) return
  filterState.value = filters[(filters.findIndex((f) => f.value === filterState.value) + 1) % filters.length]!.value
}

useShortcuts(
  'deck',
  () => t('shortcuts.groups.deck'),
  () => [
    {
      keys: ['s'],
      label: t('deck.study'),
      run: () => navigateTo(studyTo.value),
      when: () => isOwner.value && cards.value.length > 0,
    },
    { keys: ['a'], label: t('deck.addCard'), run: openAddCard, when: () => isOwner.value },
    { keys: ['e'], label: t('deck.editDeckTitle'), run: () => (deckModalOpen.value = true), when: () => isOwner.value },
    { keys: ['x'], label: t('deck.export'), run: exportThisDeck, when: () => isOwner.value && !exporting.value },
    {
      keys: ['c'],
      label: t('deck.copy'),
      run: copy,
      when: () => isLoggedIn.value && !isOwner.value && !myCopy.value && !copying.value && cards.value.length > 0,
    },
    { keys: ['r'], label: t('deck.switchDirection'), run: toggleDirection, when: () => canSwap.value },
    { keys: ['v'], label: t('shortcuts.cycleView'), run: cycleView, when: () => cards.value.length > 0 },
    { keys: ['f'], label: t('shortcuts.cycleFilter'), run: cycleFilter, when: () => visibleFilters.value.length > 1 },
    { keys: ['mod+enter'], label: t('cardEditor.saveCard'), when: () => isOwner.value },
  ],
)

const liking = ref(false)
const copying = ref(false)
async function like() {
  if (!deck.value) return
  liking.value = true
  try {
    await decks.likeDeck(deck.value)
    toast.add({ title: t('deck.toast.liked'), icon: 'i-lucide-heart', color: 'success' })
  } catch (err) {
    toast.add({ title: t('deck.toast.likeError'), description: String(err), color: 'error' })
  } finally {
    liking.value = false
  }
}
async function copy() {
  if (!deck.value) return
  copying.value = true
  try {
    const visibility: Visibility = prefs.value?.defaultVisibility ?? 'public'
    const created = await decks.copyDeck(deck.value, visibility)
    toast.add({ title: t('deck.toast.copied'), color: 'success' })
    await navigateTo(deckPath(authUser.value?.handle || authUser.value?.did || '', created.rkey))
  } catch (err) {
    toast.add({ title: t('deck.toast.copyError'), description: String(err), color: 'error' })
    copying.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div v-if="loading" class="space-y-4">
      <USkeleton class="h-8 w-2/3" />
      <USkeleton class="h-4 w-1/3" />
      <USkeleton class="h-24 w-full" />
    </div>

    <UAlert
      v-else-if="notFound"
      icon="i-lucide-search-x"
      :title="$t('deck.notFound')"
      :description="$t('deck.notFoundBody')"
      color="neutral"
      variant="subtle"
    />

    <template v-else-if="deck">
      <header class="space-y-3">
        <div class="flex items-start gap-2">
          <h1 class="text-2xl font-bold tracking-tight wrap-break-word">{{ deck.value.title }}</h1>
          <span v-if="deck.visibility === 'private'" class="mt-2 shrink-0">
            <UIcon name="i-lucide-lock" class="text-muted size-4" aria-hidden="true" />
            <span class="sr-only">{{ $t('visibility.private') }}</span>
          </span>
        </div>

        <NuxtLink
          v-if="owner"
          :to="profilePath(owner.handle)"
          class="hover:text-accent text-muted inline-flex items-center gap-2 text-sm"
        >
          <UAvatar :src="owner.avatar" :alt="owner.handle" size="2xs" />
          {{ owner.displayName || owner.handle }}
        </NuxtLink>

        <p v-if="deck.value.summary" class="text-neutral-600 dark:text-neutral-300">{{ deck.value.summary }}</p>

        <div class="text-muted flex flex-wrap items-center gap-3 text-sm">
          <span v-if="canSwap" class="inline-flex items-center gap-1.5">
            <UIcon name="i-lucide-languages" class="size-4" />
            <span>{{ shownFrom }}</span>
            <UIcon name="i-lucide-arrow-right" class="size-3.5 rtl:rotate-180" aria-hidden="true" />
            <span>{{ shownTo }}</span>
            <UButton
              icon="i-lucide-arrow-left-right"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="$t('deck.switchDirection')"
              :title="$t('deck.switchDirection')"
              aria-keyshortcuts="R"
              @click="toggleDirection"
            />
          </span>
          <span v-else-if="langs" class="inline-flex items-center gap-1"
            ><UIcon name="i-lucide-languages" class="size-4" />{{ langs }}</span
          >
          <span class="inline-flex items-center gap-1"
            ><UIcon name="i-lucide-layers" class="size-4" />{{
              $t('deck.cardsCount', { count: cards.length }, cards.length)
            }}</span
          >
        </div>

        <div v-if="deck.value.tags?.length" class="flex flex-wrap gap-1">
          <UBadge v-for="tag in deck.value.tags" :key="tag" :label="tag" color="neutral" variant="subtle" size="sm" />
        </div>

        <div class="flex flex-wrap gap-2 pt-2">
          <template v-if="isOwner">
            <UButton
              :to="studyTo"
              :label="$t('deck.study')"
              icon="i-lucide-graduation-cap"
              :disabled="cards.length === 0"
            />
            <UButton
              :label="$t('deck.addCard')"
              icon="i-lucide-plus"
              color="neutral"
              variant="subtle"
              @click="openAddCard"
            />
            <UButton
              :label="$t('deck.edit')"
              icon="i-lucide-pencil"
              color="neutral"
              variant="subtle"
              @click="deckModalOpen = true"
            />
            <UButton
              :label="$t('deck.export')"
              icon="i-lucide-download"
              color="neutral"
              variant="ghost"
              :loading="exporting"
              @click="exportThisDeck"
            />
          </template>
          <template v-else-if="isLoggedIn">
            <UButton v-if="myCopy" :to="myCopyTo" :label="$t('deck.openCopy')" icon="i-lucide-arrow-right" />
            <UButton
              v-else
              :label="$t('deck.copy')"
              icon="i-lucide-copy"
              :loading="copying"
              :disabled="cards.length === 0"
              @click="copy"
            />
            <UButton
              :label="$t('deck.like')"
              icon="i-lucide-heart"
              color="neutral"
              variant="subtle"
              :loading="liking"
              @click="like"
            />
          </template>
          <UButton
            v-else
            to="/login"
            :label="$t('deck.signInToLike')"
            icon="i-lucide-log-in"
            color="neutral"
            variant="subtle"
          />
        </div>
      </header>

      <div v-if="cards.length" class="flex flex-wrap items-center gap-3">
        <div class="flex flex-wrap gap-1" role="group" :aria-label="$t('a11y.cardFilter')">
          <UButton
            v-for="f in visibleFilters"
            :aria-pressed="filterState === f.value"
            :key="f.value"
            :label="f.label"
            size="xs"
            :color="filterState === f.value ? 'primary' : 'neutral'"
            :variant="filterState === f.value ? 'soft' : 'ghost'"
            @click="filterState = f.value"
          />
        </div>
        <div class="ms-auto flex items-center gap-1" role="group" :aria-label="$t('a11y.cardLayout')">
          <UButton
            icon="i-lucide-list"
            size="xs"
            :color="shownView === 'list' ? 'primary' : 'neutral'"
            :variant="shownView === 'list' ? 'soft' : 'ghost'"
            :aria-pressed="shownView === 'list'"
            :aria-label="$t('deck.listView')"
            :title="$t('deck.listView')"
            @click="view = 'list'"
          />
          <UButton
            icon="i-lucide-rows-4"
            size="xs"
            :color="shownView === 'dense' ? 'primary' : 'neutral'"
            :variant="shownView === 'dense' ? 'soft' : 'ghost'"
            :aria-pressed="shownView === 'dense'"
            :aria-label="$t('deck.denseView')"
            :title="$t('deck.denseView')"
            @click="view = 'dense'"
          />
          <UButton
            icon="i-lucide-layout-grid"
            size="xs"
            class="hidden sm:inline-flex"
            :color="shownView === 'grid' ? 'primary' : 'neutral'"
            :variant="shownView === 'grid' ? 'soft' : 'ghost'"
            :aria-pressed="shownView === 'grid'"
            :aria-label="$t('deck.gridView')"
            :title="$t('deck.gridView')"
            @click="view = 'grid'"
          />
          <UButton
            icon="i-lucide-group"
            size="xs"
            :color="shownView === 'grouped' ? 'primary' : 'neutral'"
            :variant="shownView === 'grouped' ? 'soft' : 'ghost'"
            :aria-pressed="shownView === 'grouped'"
            :title="$t('deck.groupView')"
            :aria-label="$t('deck.groupView')"
            @click="view = 'grouped'"
          />
          <ConfirmPopover
            v-if="isLoggedIn"
            :title="$t('deck.confirmResetProgress')"
            :confirm-label="$t('deck.resetProgress')"
            :disabled="resetting"
            @confirm="resetProgress"
          >
            <UButton
              icon="i-lucide-rotate-ccw"
              size="xs"
              color="neutral"
              variant="ghost"
              :loading="resetting"
              :aria-label="$t('deck.resetProgress')"
              :title="$t('deck.resetProgress')"
            />
          </ConfirmPopover>
        </div>
      </div>

      <section :aria-label="$t('deck.cardsCount', { count: cards.length }, cards.length)">
        <div
          v-if="cards.length === 0"
          class="border-default text-muted rounded-lg border border-dashed p-8 text-center text-sm"
        >
          <p>{{ $t('deck.noCards') }}</p>
          <UButton
            v-if="isOwner"
            class="mt-3"
            :label="$t('deck.addFirstCard')"
            icon="i-lucide-plus"
            @click="openAddCard"
          />
        </div>

        <div v-else-if="shownView === 'grouped'" class="space-y-6">
          <div v-for="group in grouped" :key="group.state" class="space-y-2">
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-semibold">{{ STATE_META[group.state].label }}</h2>
              <UBadge
                :label="String(group.cards.length)"
                :color="STATE_META[group.state].color"
                variant="subtle"
                size="sm"
              />
            </div>
            <DeckCardList
              :cards="group.cards"
              :did="deck.author"
              :is-owner="isOwner"
              :logged-in="isLoggedIn"
              :reversed="reversed"
              :front-lang="srcLang"
              :back-lang="tgtLang"
              :state-of="stateOf"
              :state-meta="STATE_META"
              @edit="openEditCard"
              @delete="deleteCard"
            />
          </div>
        </div>

        <DeckCardList
          v-else
          :cards="filtered"
          :did="deck.author"
          :is-owner="isOwner"
          :logged-in="isLoggedIn"
          :reversed="reversed"
          :front-lang="srcLang"
          :back-lang="tgtLang"
          :layout="listLayout"
          :state-of="stateOf"
          :state-meta="STATE_META"
          @edit="openEditCard"
          @delete="deleteCard"
        />
      </section>
    </template>

    <UModal v-model:open="cardModalOpen" :title="editingCard ? $t('deck.editCardTitle') : $t('deck.addCardTitle')">
      <template #body>
        <CardEditor
          :key="editingCard?.rkey ?? 'new'"
          :card="editingCard?.value"
          :saving="savingCard"
          @save="saveCard"
          @cancel="cardModalOpen = false"
        />
      </template>
    </UModal>

    <UModal v-model:open="deckModalOpen" :title="$t('deck.editDeckTitle')">
      <template #body>
        <DeckEditor
          v-if="deck"
          :deck="deck.value"
          :saving="savingDeck"
          :submit-label="$t('deck.saveChanges')"
          @save="saveDeck"
          @cancel="deckModalOpen = false"
        />
        <div class="border-default mt-4 border-t pt-4">
          <ConfirmPopover
            :title="$t('deck.confirmDeleteDeck')"
            :confirm-label="$t('deck.deleteDeck')"
            :disabled="deleting"
            @confirm="deleteDeck"
          >
            <UButton
              :label="$t('deck.deleteDeck')"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              :loading="deleting"
              :disabled="deleting"
            />
          </ConfirmPopover>
        </div>
      </template>
    </UModal>
  </div>
</template>

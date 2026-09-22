<script setup lang="ts">
import type { CardFormData } from '~/components/CardEditor.vue'
import type { StateColor } from '~/components/DeckCardList.vue'
import type { DeckFormData } from '~/components/DeckEditor.vue'
import type { CardView, DeckView, Visibility } from '~/composables/useDecks'
import type { ProgressRecord } from '~/composables/useStudy'
import { useI18n } from 'vue-i18n'
import { getBskyProfile, type BskyProfile } from '~/utils/bsky'
import { directionKey, isDue, type ProgressState, type StudyDirection } from '~/utils/fsrs'

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
const loading = ref(true)
const notFound = ref(false)

const isOwner = computed(() => Boolean(deck.value && authUser.value?.did === deck.value.author))

useHead(() => ({ title: deck.value ? `${deck.value.value.title} · OpenDeck` : 'Deck · OpenDeck' }))

async function resolveDid(actor: string): Promise<string | null> {
  if (actor.startsWith('did:')) return actor
  return (await getBskyProfile(actor))?.did ?? null
}

async function load() {
  loading.value = true
  notFound.value = false
  deck.value = null
  cards.value = []
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

    if (isLoggedIn.value) progressMap.value = await study.loadProgressMap().catch(() => new Map())
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

const view = ref<'list' | 'grid' | 'grouped'>('list')
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
  if (!deck.value || !confirm(t('deck.confirmDeleteCard'))) return
  try {
    await decks.deleteCard(card.rkey, deck.value.visibility)
    cards.value = cards.value.filter((c) => c.rkey !== card.rkey)
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

async function deleteDeck() {
  if (!deck.value || !confirm(t('deck.confirmDeleteDeck'))) return
  try {
    await decks.deleteDeck(deck.value.rkey, deck.value.visibility)
    toast.add({ title: t('deck.toast.deckDeleted'), color: 'success' })
    await navigateTo('/')
  } catch (err) {
    toast.add({ title: t('deck.toast.deleteDeckError'), description: String(err), color: 'error' })
  }
}

const resetting = ref(false)
async function resetProgress() {
  if (!confirm(t('deck.confirmResetProgress'))) return
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
          <UIcon
            v-if="deck.visibility === 'private'"
            name="i-lucide-lock"
            class="mt-2 size-4 shrink-0 text-neutral-400"
          />
        </div>

        <NuxtLink
          v-if="owner"
          :to="profilePath(owner.handle)"
          class="hover:text-accent inline-flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400"
        >
          <UAvatar :src="owner.avatar" :alt="owner.handle" size="2xs" />
          {{ owner.displayName || owner.handle }}
        </NuxtLink>

        <p v-if="deck.value.summary" class="text-neutral-600 dark:text-neutral-300">{{ deck.value.summary }}</p>

        <div class="flex flex-wrap items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
          <button
            v-if="canSwap"
            type="button"
            class="hover:text-accent inline-flex items-center gap-1.5"
            :title="$t('deck.switchDirection')"
            :aria-label="$t('deck.switchDirection')"
            @click="toggleDirection"
          >
            <UIcon name="i-lucide-languages" class="size-4" />
            <span>{{ shownFrom }}</span>
            <UIcon name="i-lucide-arrow-right" class="size-3.5" />
            <span>{{ shownTo }}</span>
          </button>
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
          <UButton
            :to="studyTo"
            :label="$t('deck.study')"
            icon="i-lucide-graduation-cap"
            :disabled="cards.length === 0"
          />

          <template v-if="isOwner">
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
            <UButton
              :label="$t('deck.like')"
              icon="i-lucide-heart"
              color="neutral"
              variant="subtle"
              :loading="liking"
              @click="like"
            />
            <UButton
              :label="$t('deck.copy')"
              icon="i-lucide-copy"
              color="neutral"
              variant="subtle"
              :loading="copying"
              @click="copy"
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
        <div class="flex flex-wrap gap-1">
          <UButton
            v-for="f in visibleFilters"
            :key="f.value"
            :label="f.label"
            size="xs"
            :color="filterState === f.value ? 'primary' : 'neutral'"
            :variant="filterState === f.value ? 'soft' : 'ghost'"
            @click="filterState = f.value"
          />
        </div>
        <div class="ms-auto flex items-center gap-1">
          <UButton
            icon="i-lucide-list"
            size="xs"
            :color="view === 'list' ? 'primary' : 'neutral'"
            :variant="view === 'list' ? 'soft' : 'ghost'"
            :aria-label="$t('deck.listView')"
            @click="view = 'list'"
          />
          <UButton
            icon="i-lucide-layout-grid"
            size="xs"
            :color="view === 'grid' ? 'primary' : 'neutral'"
            :variant="view === 'grid' ? 'soft' : 'ghost'"
            :aria-label="$t('deck.gridView')"
            @click="view = 'grid'"
          />
          <UButton
            icon="i-lucide-group"
            size="xs"
            :color="view === 'grouped' ? 'primary' : 'neutral'"
            :variant="view === 'grouped' ? 'soft' : 'ghost'"
            :aria-label="$t('deck.groupView')"
            @click="view = 'grouped'"
          />
          <UButton
            v-if="isLoggedIn"
            icon="i-lucide-rotate-ccw"
            size="xs"
            color="neutral"
            variant="ghost"
            :loading="resetting"
            :aria-label="$t('deck.resetProgress')"
            :title="$t('deck.resetProgress')"
            @click="resetProgress"
          />
        </div>
      </div>

      <section>
        <div
          v-if="cards.length === 0"
          class="border-default rounded-lg border border-dashed p-8 text-center text-sm text-neutral-500"
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

        <div v-else-if="view === 'grouped'" class="space-y-6">
          <div v-for="group in grouped" :key="group.state" class="space-y-2">
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-semibold">{{ STATE_META[group.state].label }}</h3>
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
              :state-of="stateOf"
              :state-meta="STATE_META"
              @edit="openEditCard"
              @delete="deleteCard"
            />
          </div>
        </div>

        <div v-else-if="view === 'grid'" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="card in filtered" :key="card.rkey" class="border-default rounded-lg border p-3">
            <div class="flex items-start justify-between gap-2">
              <p class="font-medium wrap-break-word">{{ card.value.front }}</p>
              <UBadge
                v-if="isLoggedIn"
                :label="STATE_META[stateOf(card)].label"
                :color="STATE_META[stateOf(card)].color"
                variant="subtle"
                size="sm"
                class="shrink-0"
              />
            </div>
            <p class="mt-1 text-sm wrap-break-word text-neutral-500 dark:text-neutral-400">{{ card.value.back }}</p>
            <CardMedia
              v-if="card.value.image || card.value.audio"
              :did="deck.author"
              :image="card.value.image"
              :image-alt="card.value.imageAlt"
              :audio="card.value.audio"
              class="mt-2"
            />
            <div v-if="isOwner" class="mt-2 flex gap-1">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="$t('deck.editCardTitle')"
                @click="openEditCard(card)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                :aria-label="$t('common.delete')"
                @click="deleteCard(card)"
              />
            </div>
          </div>
        </div>

        <DeckCardList
          v-else
          :cards="filtered"
          :did="deck.author"
          :is-owner="isOwner"
          :logged-in="isLoggedIn"
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
          <UButton
            :label="$t('deck.deleteDeck')"
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="sm"
            @click="deleteDeck"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

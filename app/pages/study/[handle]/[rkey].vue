<script setup lang="ts">
import type { CardView } from '~/composables/useDecks'
import type { StudyItem } from '~/composables/useStudy'
import type { Grade } from 'ts-fsrs'
import { useI18n } from 'vue-i18n'
import { getBskyProfile } from '~/utils/bsky'
import { intervalPreview, RATINGS } from '~/utils/fsrs'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const route = useRoute()
const authUser = useAuthUser()
const decks = useDecks()
const study = useStudy()

const handle = computed(() => route.params.handle as string)
const rkey = computed(() => route.params.rkey as string)

const loading = ref(true)
const notFound = ref(false)
const deckTitle = ref('')
const deckUri = ref('')
const authorDid = ref('')
const queue = ref<StudyItem[]>([])
const index = ref(0)
const revealed = ref(false)
const showHint = ref(false)
const flipped = ref(false)
const reviewed = ref(0)
const total = ref(0)

const current = computed(() => queue.value[index.value] ?? null)

const shownFront = computed(
  () => (flipped.value ? current.value?.card.value.back : current.value?.card.value.front) ?? '',
)
const shownBack = computed(
  () => (flipped.value ? current.value?.card.value.front : current.value?.card.value.back) ?? '',
)
const done = computed(() => !loading.value && !notFound.value && !current.value)
const preview = computed(() => (current.value ? intervalPreview(current.value.progress) : null))

useHead(() => ({
  title: deckTitle.value ? `${t('study.title')} ${deckTitle.value} · OpenDeck` : `${t('study.title')} · OpenDeck`,
}))

async function resolveDid(actor: string): Promise<string | null> {
  if (actor.startsWith('did:')) return actor
  return (await getBskyProfile(actor))?.did ?? null
}

onMounted(async () => {
  const sync = useSync()
  try {
    const did = await resolveDid(handle.value)
    if (!did) return void (notFound.value = true)

    const isMine = authUser.value?.did === did
    authorDid.value = did
    deckUri.value = `at://${did}/space.opendeck.deck/${rkey.value}`

    let cards: CardView[]
    if (sync.online.value) {
      const deck = isMine ? await decks.getMyDeck(rkey.value) : await decks.getForeignDeck(did, rkey.value)
      if (!deck) return void (notFound.value = true)
      deckTitle.value = deck.value.title
      deckUri.value = deck.uri
      cards = isMine
        ? await decks.listMyCards(rkey.value, deck.visibility)
        : await decks.listForeignCards(did, deck.rkey)
      await sync.cacheCards(deck.uri, cards)
    } else {
      cards = await sync.getCachedCards(deckUri.value)
      if (cards.length === 0) return void (notFound.value = true)
    }

    const map = await study.loadProgressMap()
    queue.value = study.buildQueue(cards, map, true)
    total.value = queue.value.length
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

const grading = ref(false)
async function grade(g: Grade) {
  if (!current.value || !revealed.value || grading.value) return
  grading.value = true
  try {
    await study.grade(current.value, g)
    reviewed.value++
    index.value++
    revealed.value = false
    showHint.value = false
  } catch (err) {
    console.error(err)
    useToast().add({ title: t('study.saveProgressError'), description: String(err), color: 'error' })
  } finally {
    grading.value = false
  }
}

const cardRef = ref<HTMLElement | null>(null)
useSwipe(cardRef, {
  threshold: 40,
  onSwipeEnd(_e, direction) {
    if (!revealed.value) {
      if (direction !== 'none') reveal()
      return
    }
    const map: Record<string, Grade | undefined> = {
      left: RATINGS[0].grade,
      down: RATINGS[1].grade,
      up: RATINGS[3].grade,
      right: RATINGS[2].grade,
    }
    const g = map[direction]
    if (g !== undefined) grade(g)
  },
})

function onKey(e: KeyboardEvent) {
  if (done.value) return
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault()
    if (!revealed.value) reveal()
    return
  }
  if (revealed.value && ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
    e.preventDefault()
    const rating = RATINGS[Number(e.code.slice(-1)) - 1]
    if (rating) grade(rating.grade)
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="mx-auto max-w-xl space-y-6">
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
        <UProgress v-if="total > 0" :model-value="reviewed" :max="total" size="sm" class="mt-1" />
      </div>
      <UButton
        icon="i-lucide-arrow-left-right"
        :color="flipped ? 'primary' : 'neutral'"
        :variant="flipped ? 'soft' : 'ghost'"
        size="sm"
        :aria-label="flipped ? $t('study.showingBack') : $t('study.showingFront')"
        :title="flipped ? $t('study.flipAnswering') : $t('study.flipTitle')"
        @click="flipped = !flipped"
      />
      <span v-if="total > 0" class="text-sm text-neutral-400">{{ reviewed }}/{{ total }}</span>
    </div>

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
      <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {{ total > 0 ? $t('study.reviewed', { count: reviewed }, reviewed) : $t('study.comeBackLater') }}
      </p>
      <div class="mt-4 flex justify-center gap-3">
        <UButton :to="deckPath(handle, rkey)" :label="$t('study.backToDeck')" color="neutral" variant="subtle" />
        <UButton to="/study" :label="$t('study.studyOverview')" icon="i-lucide-graduation-cap" />
      </div>
    </div>
    <template v-else-if="current">
      <div ref="cardRef" role="button" tabindex="0" @click="reveal">
        <StudyCard
          :front="shownFront"
          :back="shownBack"
          :hint="current.card.value.hint"
          :phonetic="current.card.value.phonetic"
          :examples="current.card.value.examples"
          :did="authorDid"
          :image="current.card.value.image"
          :image-alt="current.card.value.imageAlt"
          :audio="current.card.value.audio"
          :show-hint="showHint"
          :revealed="revealed"
          @reveal-hint="showHint = true"
        />
      </div>

      <div v-if="!revealed" class="text-center">
        <UButton :label="$t('study.reveal')" icon="i-lucide-eye" size="lg" variant="subtle" @click="reveal" />
      </div>

      <div v-else class="grid grid-cols-4 gap-2">
        <UButton
          v-for="(r, i) in RATINGS"
          :key="r.key"
          :color="r.color"
          variant="subtle"
          class="flex-col py-2"
          :disabled="grading"
          @click="grade(r.grade)"
        >
          <span class="font-medium">{{ $t(`study.ratings.${r.key}`) }}</span>
          <span class="text-xs opacity-70">{{ preview?.[r.key] }}</span>
          <span class="mt-0.5 text-[10px] opacity-50">{{ i + 1 }}</span>
        </UButton>
      </div>
    </template>
  </div>
</template>

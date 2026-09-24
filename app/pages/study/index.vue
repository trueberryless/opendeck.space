<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { DeckView } from '~/composables/useDecks'

definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
useHead(() => ({ title: `${t('study.title')} · OpenDeck` }))

const authUser = useAuthUser()
const decks = useDecks()
const study = useStudy()

const selfActor = computed(() => authUser.value?.handle || authUser.value?.did || '')

interface Row {
  deck: DeckView
  total: number
  due: number
}

const rows = ref<Row[]>([])
const loading = ref(true)
const totalDue = computed(() => rows.value.reduce((n, r) => n + r.due, 0))

onMounted(async () => {
  try {
    const [myDecks, progressMap] = await Promise.all([decks.listMyDecks(), study.loadProgressMap()])
    rows.value = await Promise.all(
      myDecks.map(async (deck) => {
        const cards = await decks.listMyCards(deck.rkey, deck.visibility)
        return { deck, total: cards.length, due: study.dueCount(cards, progressMap, 'forward') }
      }),
    )
    rows.value.sort((a, b) => b.due - a.due)
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <header>
      <h1 class="text-2xl font-bold tracking-tight">{{ $t('study.title') }}</h1>
      <p class="text-muted text-sm" role="status">
        <template v-if="loading">{{ $t('study.loadingSchedule') }}</template>
        <template v-else-if="totalDue > 0">{{ $t('study.dueAcross', { count: totalDue }, totalDue) }}</template>
        <template v-else>{{ $t('study.caughtUp') }}</template>
      </p>
    </header>

    <div v-if="loading" class="space-y-3">
      <USkeleton v-for="i in 3" :key="i" class="h-16 w-full" />
    </div>

    <div v-else-if="rows.length === 0" class="border-default rounded-lg border border-dashed p-10 text-center">
      <UIcon name="i-lucide-layers" class="text-muted mx-auto size-8" />
      <p class="mt-3 font-medium">{{ $t('study.noDecksTitle') }}</p>
      <UButton to="/decks/new" class="mt-4" :label="$t('study.createDeck')" icon="i-lucide-plus" />
    </div>

    <ul v-else class="divide-default border-default divide-y overflow-hidden rounded-lg border">
      <li v-for="row in rows" :key="row.deck.uri" class="flex items-center gap-4 p-4">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <NuxtLink :to="deckPath(selfActor, row.deck.rkey)" class="hover:text-accent truncate font-medium">
              {{ row.deck.value.title }}
            </NuxtLink>
            <span v-if="row.deck.visibility === 'private'" class="flex">
              <UIcon name="i-lucide-lock" class="text-muted size-3.5" aria-hidden="true" />
              <span class="sr-only">{{ $t('visibility.private') }}</span>
            </span>
          </div>
          <p class="text-muted text-xs">
            {{ $t('study.cardsCount', { count: row.total }, row.total) }}
          </p>
        </div>
        <UBadge
          v-if="row.due > 0"
          :label="$t('study.dueBadge', { count: row.due }, row.due)"
          color="primary"
          variant="subtle"
        />
        <UButton
          :to="studyPath(selfActor, row.deck.rkey)"
          :label="row.due > 0 ? $t('study.studyBtn') : $t('study.reviewBtn')"
          :color="row.due > 0 ? 'primary' : 'neutral'"
          :variant="row.due > 0 ? 'solid' : 'subtle'"
          :disabled="row.total === 0"
          size="sm"
        />
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { Visibility } from '~/composables/useDecks'

const route = useRoute()
const authUser = useAuthUser()
const isLoggedIn = useIsLoggedIn()
const toast = useToast()

const { get, groupBySection, toParsedDeck } = useStarterDecks()
const { supported, ensure } = useSpacesSupport()
const { prefs } = useProfile()
const { progress, runImport, reset } = useImport()

const id = computed(() => route.params.id as string)
const deck = computed(() => get(id.value))
const sections = computed(() => (deck.value ? groupBySection(deck.value) : []))

useHead(() => ({ title: deck.value ? `${deck.value.title} · OpenDeck` : 'Starter deck · OpenDeck' }))

const visibility = ref<Visibility>('public')
const adding = ref(false)

const selfActor = computed(() => authUser.value?.handle || authUser.value?.did || '')
const createdRkey = computed(() => progress.value.created[0]?.rkey ?? null)
const done = computed(() => progress.value.status === 'done' && createdRkey.value)
const pct = computed(() =>
  progress.value.totalCards ? Math.round((progress.value.doneCards / progress.value.totalCards) * 100) : 0,
)

onMounted(async () => {
  reset()
  if (await ensure()) visibility.value = prefs.value?.defaultVisibility ?? 'private'
})

async function add() {
  if (!deck.value || adding.value) return
  adding.value = true
  try {
    await runImport([toParsedDeck(deck.value)], visibility.value)
    if (progress.value.status === 'done') {
      toast.add({ title: 'Added to your decks 🎉', color: 'success' })
    } else if (progress.value.status === 'error') {
      toast.add({ title: 'Could not add deck', description: progress.value.errors.join(' '), color: 'error' })
    }
  } finally {
    adding.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6">
    <UButton to="/starter" icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" label="Starter decks" />

    <div v-if="!deck" class="border-default rounded-lg border border-dashed p-10 text-center">
      <UIcon name="i-lucide-search-x" class="mx-auto size-8 text-neutral-400" />
      <p class="mt-3 font-medium">Deck not found</p>
      <p class="mt-1 text-sm text-neutral-500">This starter deck doesn’t exist.</p>
    </div>

    <template v-else>
      <header class="space-y-3">
        <div class="flex items-start gap-3">
          <span v-if="deck.flag" class="text-4xl leading-none" aria-hidden="true">{{ deck.flag }}</span>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h1 class="text-2xl font-bold tracking-tight">{{ deck.title }}</h1>
              <UIcon
                v-if="deck.verified"
                name="i-lucide-badge-check"
                class="text-accent size-5 shrink-0"
                aria-label="Verified translations"
              />
            </div>
            <div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
              <span v-if="deck.sourceLang && deck.targetLang" class="inline-flex items-center gap-1">
                <UIcon name="i-lucide-languages" class="size-4" />
                {{ deck.sourceLang }} → {{ deck.targetLang }}
              </span>
              <span class="inline-flex items-center gap-1">
                <UIcon name="i-lucide-layers" class="size-4" />
                {{ deck.cards.length }} cards
              </span>
              <UBadge v-if="deck.level" :label="deck.level" color="neutral" variant="subtle" size="sm" />
            </div>
          </div>
        </div>
        <p v-if="deck.summary" class="text-sm text-neutral-600 dark:text-neutral-300">{{ deck.summary }}</p>
      </header>

      <section class="border-default rounded-lg border p-4">
        <template v-if="done">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm font-medium">Added to your decks 🎉</p>
            <UButton
              :to="deckPath(selfActor, createdRkey!)"
              label="Open deck"
              icon="i-lucide-arrow-right"
              trailing
              size="sm"
            />
          </div>
        </template>

        <template v-else-if="adding || progress.status === 'running' || progress.status === 'paused'">
          <div class="mb-2 flex items-center justify-between">
            <p class="text-sm font-medium">
              <template v-if="progress.status === 'paused'">Paused for rate limit…</template>
              <template v-else>Adding…</template>
            </p>
            <span class="text-sm text-neutral-400">{{ progress.doneCards }}/{{ progress.totalCards }}</span>
          </div>
          <UProgress :model-value="pct" :max="100" />
          <p v-if="progress.status === 'paused'" class="text-warning mt-2 text-xs">
            Waiting {{ progress.pauseSeconds }}s to stay within your PDS rate limit…
          </p>
        </template>

        <template v-else-if="isLoggedIn">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <UFormField v-if="supported" label="Visibility">
              <div class="flex gap-2">
                <UButton
                  :color="visibility === 'public' ? 'primary' : 'neutral'"
                  :variant="visibility === 'public' ? 'solid' : 'subtle'"
                  icon="i-lucide-globe"
                  label="Public"
                  size="sm"
                  @click="visibility = 'public'"
                />
                <UButton
                  :color="visibility === 'private' ? 'primary' : 'neutral'"
                  :variant="visibility === 'private' ? 'solid' : 'subtle'"
                  icon="i-lucide-lock"
                  label="Private"
                  size="sm"
                  @click="visibility = 'private'"
                />
              </div>
            </UFormField>
            <p v-else class="text-sm text-neutral-500">A copy is saved to your ATproto repository.</p>
            <UButton label="Add to my decks" icon="i-lucide-plus" size="lg" @click="add" />
          </div>
          <UAlert
            v-if="progress.status === 'error'"
            class="mt-3"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :description="progress.errors.join(' ')"
          />
        </template>

        <template v-else>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-neutral-500">Sign in to save this deck to your own account.</p>
            <UButton to="/login" label="Sign in" icon="i-lucide-log-in" size="sm" />
          </div>
        </template>
      </section>

      <section class="space-y-5">
        <h2 class="text-sm font-medium text-neutral-500">Preview</h2>
        <div v-for="group in sections" :key="group.section" class="space-y-2">
          <h3 class="text-xs font-semibold tracking-wide text-neutral-400 uppercase">{{ group.section }}</h3>
          <ul class="divide-default border-default divide-y overflow-hidden rounded-lg border">
            <li v-for="(card, i) in group.cards" :key="i" class="flex items-baseline gap-4 p-3 text-sm">
              <span class="min-w-0 flex-1 text-neutral-600 dark:text-neutral-300">{{ card.front }}</span>
              <span class="min-w-0 flex-1 text-right font-medium">
                {{ card.back }}
                <span v-if="card.phonetic" class="block text-xs font-normal text-neutral-400">{{ card.phonetic }}</span>
                <span v-if="card.hint" class="block text-xs font-normal text-neutral-400">{{ card.hint }}</span>
              </span>
            </li>
          </ul>
        </div>
      </section>

      <p v-if="deck.attribution" class="border-default border-t pt-4 text-xs text-neutral-400">
        {{ deck.attribution }}
      </p>
    </template>
  </div>
</template>

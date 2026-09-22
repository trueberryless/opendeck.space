<script setup lang="ts">
useHead({ title: 'Starter decks · OpenDeck' })

const { list } = useStarterDecks()
const decks = list()

const query = ref('')

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return decks
  return decks.filter((d) =>
    [d.title, d.targetLangLabel, d.targetLang, ...(d.tags ?? [])].some((v) => v?.toLowerCase().includes(q)),
  )
})
</script>

<template>
  <div class="space-y-8">
    <header class="space-y-2">
      <h1 class="text-2xl font-bold tracking-tight">Starter decks</h1>
      <p class="max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
        Hand-crafted decks to start a new language from zero. Each one is a “survival” set — roughly 120 of the most
        useful words and phrases for greetings, shopping, numbers, getting around and handling problems on a short trip.
        Pick a language and add it to your decks in one tap.
      </p>
    </header>

    <UInput
      v-model="query"
      icon="i-lucide-search"
      placeholder="Search languages…"
      size="lg"
      class="w-full max-w-sm"
      :ui="{ base: 'w-full' }"
    />

    <div
      v-if="filtered.length === 0"
      class="border-default rounded-lg border border-dashed p-8 text-center text-sm text-neutral-500"
    >
      No starter decks match “{{ query }}”.
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="deck in filtered"
        :key="deck.id"
        :to="`/starter/${deck.id}`"
        class="border-default hover::border-(--accent) block rounded-lg border p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
      >
        <div class="flex items-start gap-3">
          <span v-if="deck.flag" class="text-2xl leading-none" aria-hidden="true">{{ deck.flag }}</span>
          <div class="min-w-0 flex-1">
            <h3 class="line-clamp-2 font-semibold">{{ deck.title }}</h3>
            <p v-if="deck.summary" class="mt-1 line-clamp-2 text-sm text-neutral-500 dark:text-neutral-400">
              {{ deck.summary }}
            </p>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <span v-if="deck.sourceLang && deck.targetLang" class="inline-flex items-center gap-1">
            <UIcon name="i-lucide-languages" class="size-3.5" />
            {{ deck.sourceLang }} → {{ deck.targetLang }}
          </span>
          <span class="inline-flex items-center gap-1">
            <UIcon name="i-lucide-layers" class="size-3.5" />
            {{ deck.cards.length }} cards
          </span>
          <UBadge v-if="deck.level" :label="deck.level" color="neutral" variant="subtle" size="sm" />
        </div>
      </NuxtLink>
    </div>

    <p class="text-xs text-neutral-400">
      Inspired by Paul Nation &amp; David Crabbe’s survival vocabulary lists. Want another language?
      <NuxtLink
        to="https://github.com/trueberryless/opendeck.space"
        class="hover:text-accent underline"
        target="_blank"
      >
        Contribute a deck
      </NuxtLink>
      — it’s just a JSON file.
    </p>
  </div>
</template>

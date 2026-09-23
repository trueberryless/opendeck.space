<script setup lang="ts">
import type { DeckView } from '~/composables/useDecks'

const props = defineProps<{
  deck: DeckView
  to?: string
  cardCount?: number
}>()

const langs = computed(() => {
  const s = props.deck.value.sourceLang
  const t = props.deck.value.targetLang
  if (s && t) return { from: s, to: t }
  const single = t || s
  return single ? { single } : null
})
</script>

<template>
  <NuxtLink
    :to="to"
    class="border-default hover::border-(--accent) block rounded-lg border p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
  >
    <div class="flex items-start justify-between gap-3">
      <h3 class="line-clamp-2 font-semibold">{{ deck.value.title }}</h3>
      <UIcon
        v-if="deck.visibility === 'private'"
        name="i-lucide-lock"
        class="mt-0.5 size-4 shrink-0 text-neutral-400"
        aria-label="Private deck"
      />
    </div>

    <p v-if="deck.value.summary" class="mt-1 line-clamp-2 text-sm text-neutral-500 dark:text-neutral-400">
      {{ deck.value.summary }}
    </p>

    <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
      <span v-if="langs" class="inline-flex items-center gap-1">
        <UIcon name="i-lucide-languages" class="size-3.5" />
        <template v-if="'single' in langs">{{ langs.single }}</template>
        <template v-else>
          {{ langs.from }}
          <UIcon name="i-lucide-arrow-right" class="size-3" />
          {{ langs.to }}
        </template>
      </span>
      <span v-if="typeof cardCount === 'number'" class="inline-flex items-center gap-1">
        <UIcon name="i-lucide-layers" class="size-3.5" />
        {{ $t('deck.cardsCount', { count: cardCount }, cardCount) }}
      </span>
    </div>

    <div v-if="deck.value.tags?.length" class="mt-3 flex flex-wrap gap-1">
      <UBadge
        v-for="tag in deck.value.tags.slice(0, 4)"
        :key="tag"
        :label="tag"
        color="neutral"
        variant="subtle"
        size="sm"
      />
    </div>
  </NuxtLink>
</template>

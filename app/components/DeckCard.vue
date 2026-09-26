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
    class="border-default surface block rounded-lg border p-4 transition-colors hover:border-(--accent) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
  >
    <div class="flex items-start justify-between gap-3">
      <h3 class="line-clamp-2 font-semibold">{{ deck.value.title }}</h3>
      <span v-if="deck.visibility === 'private'" class="mt-0.5 shrink-0">
        <UIcon name="i-lucide-lock" class="text-muted size-4" aria-hidden="true" />
        <span class="sr-only">{{ $t('visibility.private') }}</span>
      </span>
    </div>

    <p v-if="deck.value.summary" class="text-muted mt-1 line-clamp-2 text-sm">
      {{ deck.value.summary }}
    </p>

    <div class="text-muted mt-3 flex flex-wrap items-center gap-2 text-xs">
      <span v-if="langs" class="inline-flex items-center gap-1">
        <UIcon name="i-lucide-languages" class="size-3.5" aria-hidden="true" />
        <template v-if="'single' in langs">{{ langs.single }}</template>
        <template v-else>
          {{ langs.from }}
          <UIcon name="i-lucide-arrow-right" class="size-3 rtl:rotate-180" aria-hidden="true" />
          {{ langs.to }}
        </template>
      </span>
      <span v-if="typeof cardCount === 'number'" class="inline-flex items-center gap-1">
        <UIcon name="i-lucide-layers" class="size-3.5" aria-hidden="true" />
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
